function populateThemes(data, select) {
    Object.entries(data).forEach(([themeName, themeTones]) => {
        const option = document.createElement('option');
        // Convert the theme tones object to a JSON string for the option value
        option.value = JSON.stringify(themeTones);
        option.textContent = themeName;
        select.appendChild(option);
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    await loadJsonAndPopulateSelect('/static/json/themes.json', 'theme', populateThemes);
    await fetch("/load_settings")
        .then(response => response.json())
        .then(data => {
            if (data) {
                
                document.getElementById("theme").value = JSON.stringify(data.theme) || '{"tone_1":"240, 240, 240","tone_2":"240, 218, 218","tone_3":"240, 163, 163"}';
                document.getElementById("attention-slicing").value = data.enable_attention_slicing ? "True" : "False";
                document.getElementById("xformers").value = data.enable_xformers_memory_efficient_attention ? "True" : "False";
                document.getElementById("cpu-offload").value = data.enable_model_cpu_offload ? "True" : "False";
                document.getElementById("sequential-cpu").value = data.enable_sequential_cpu_offload ? "True" : "False";
                document.getElementById("long-clip").value = data.use_long_clip ? "True" : "False";
                document.getElementById("show-latents").value = data.show_latents ? "True" : "False";
                document.getElementById("load-previous-data").value = data.load_previous_data ? "True" : "False";
                document.getElementById("use-multi-prompt").value = data.use_multi_prompt ? "True" : "False";
                console.log(data.multi_prompt_separator);
                document.getElementById("multi-prompt-separator").value = data.multi_prompt_separator || "§";
            }
        })
        .catch(error => console.error('Error loading settings:', error));
});

function saveSettings(event) {
    event.preventDefault();

    const settings = {};

    // Handle theme separately
    const themeValue = document.getElementById('theme').value;
    if (themeValue) {
        try {
            const theme = JSON.parse(themeValue);
            settings.theme = theme; // Store theme if valid
        } catch (error) {
            console.error('Error parsing theme:', error);
        }
    }
    else

    // Handle other settings
    settings.enable_attention_slicing = document.getElementById("attention-slicing").value === "True";
    settings.enable_xformers_memory_efficient_attention = document.getElementById("xformers").value === "True";
    settings.enable_model_cpu_offload = document.getElementById("cpu-offload").value === "True";
    settings.enable_sequential_cpu_offload = document.getElementById("sequential-cpu").value === "True";
    settings.use_long_clip = document.getElementById("long-clip").value === "True";
    settings.show_latents = document.getElementById("show-latents").value === "True";
    settings.load_previous_data = document.getElementById("load-previous-data").value === "True";
    settings.use_multi_prompt = document.getElementById("use-multi-prompt").value === "True";
    settings.multi_prompt_separator = document.getElementById("multi-prompt-separator").value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');

    fetch('/save_settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
    })
    .then(response => response.json())
    .then(data => {
        alert(data.status);
    })
    .catch(error => console.error('Error:', error));
}

document.getElementById('theme').addEventListener('change', function () {
    try {
        const theme = JSON.parse(this.value);

        // Set CSS variables
        document.documentElement.style.setProperty('--tone1', theme.tone_1);
        document.documentElement.style.setProperty('--tone2', theme.tone_2);
        document.documentElement.style.setProperty('--tone3', theme.tone_3);
    } catch (error) {
        console.error('Error applying theme:', error);
    }
});
