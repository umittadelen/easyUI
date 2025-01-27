import os
import subprocess
import shutil
import json
from urllib.parse import urlencode, urlparse, urlunparse, parse_qs

gconfig = {

}

def askForAPIKey():
    key = input("Enter API key: ").strip()
    with open("civitai-api.key", "w") as f:
        f.write(key)
    return key

def downloadModelFromCivitai(modelUrl):
    gconfig["downloading"] = True
    try:
        api_key = open("civitai-api.key", "r").read().strip() if os.path.exists("civitai-api.key") else askForAPIKey()

        temp_directory = "./models/temp"
        os.makedirs(temp_directory, exist_ok=True)

        def is_command_available(cmd):
            return shutil.which(cmd) is not None

        def append_token(url, key, value):
            parsed = urlparse(url)
            query = parse_qs(parsed.query)
            query[key] = value
            return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))

        def update_models_json(file_name, file_path):
            models_data = (json.load(open('./static/json/models.json', 'r', encoding='utf-8')) if os.path.exists('./static/json/models.json') else {})
            models_data[file_name] = {"path":file_path, "cfg":"7", "disabled": False, "type":"SDXL", "link":modelUrl}
            json.dump(models_data, open('./static/json/models.json', 'w', encoding='utf-8'), indent=4)

        def fix_path_slashes(path):
            return path.replace("\\", "/")
        
        if modelUrl.find("?") != -1:
            modelUrl = modelUrl[:modelUrl.find("?")]

        if "token" not in modelUrl:
            modelUrl = append_token(modelUrl, "token", api_key)

        print(f"modelUrl: ({modelUrl})")

        if is_command_available("aria2c"):
            print("Using aria2c for download.")
            subprocess.run(f"aria2c --console-log-level=error --summary-interval=10 -c -x 16 -k 1M -s 16 -d {temp_directory} {modelUrl}", shell=True)
        elif is_command_available("wget"):
            print("Using wget for download.")
            subprocess.run(f"wget -q -c -P {temp_directory} '{modelUrl}'", shell=True)
        elif is_command_available("curl"):
            print("Using curl for download.")
            sanitized_url = modelUrl.split('?')[0]
            file_name = os.path.basename(sanitized_url)
            subprocess.run(f"curl -L -o \"{os.path.join(temp_directory, file_name)}\" \"{modelUrl}\"", shell=True)
        else:
            print("No suitable download tool found.")

        files = os.listdir(temp_directory)
        if files:
            file_name = files[0]
            file_path = os.path.join(temp_directory, file_name)
            destination_path = fix_path_slashes(os.path.join("./models", file_name))

            shutil.move(file_path, destination_path)
            print(f"Moved file to {destination_path}")

            shutil.rmtree(temp_directory)
            print("Deleted temp directory.")
            
            update_models_json(file_name.replace(".safetensors", "").replace("_", " "), destination_path)
        else:
            print("No files were downloaded.")
    finally:
        gconfig["downloading"] = False

if __name__ == "__main__":
    modelUrl = input("Enter model URL: ")
    downloadModelFromCivitai(modelUrl)