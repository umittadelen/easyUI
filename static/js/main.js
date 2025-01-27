class CustomConfirm {
    constructor() {
        this.overlay = null;
        this.box = null;
        this.isActive = false; // Tracks if a dialog is currently active
        this.escKeyListener = null; // Store reference to the keydown listener
    }

    createConfirm(message, buttons, overlayReturnValue) {
        return new Promise((resolve) => {
            // Prevent creating multiple dialogs
            if (this.isActive) {
                console.warn("A confirm dialog is already active.");
                return;
            }
            this.isActive = true;

            // Create overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'custom-confirm-overlay';

            // Create confirm box
            this.box = document.createElement('div');
            this.box.className = 'custom-confirm-box';

            // Add message
            const msg = document.createElement('p');
            message = message.replace(/\n/g, '<br>');
            msg.innerHTML = message;
            this.box.appendChild(msg);

            // Add button container
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';

            // Add buttons to the button container
            buttons.forEach((buttonConfig) => {
                const button = document.createElement('button');
                button.textContent = buttonConfig.text;
                button.addEventListener('click', () => {
                    this.closeConfirm();
                    // Execute the button's value (function) and resolve
                    if (typeof buttonConfig.value === 'function') {
                        buttonConfig.value();
                    }
                    resolve(buttonConfig.value);
                });
                buttonContainer.appendChild(button);
            });

            // Append button container to the box
            this.box.appendChild(buttonContainer);

            // Append the box to the overlay and the overlay to the document body
            this.overlay.appendChild(this.box);
            document.body.appendChild(this.overlay);

            // Force reflow to ensure the transition is applied
            window.getComputedStyle(this.overlay).opacity;

            // Add the show class to trigger the transition
            this.overlay.classList.add('show');
            this.box.classList.add('show');

            // Add overlay click listener
            this.overlay.addEventListener('click', (e) => {
                // Prevent click events from propagating when clicking the confirm box itself
                if (e.target === this.overlay) {
                    this.closeConfirm();
                    resolve(overlayReturnValue);
                }
            });

            // Add Esc key listener
            this.escKeyListener = (e) => {
                if (e.key === 'Escape') {
                    this.closeConfirm();
                    resolve(overlayReturnValue);
                }
            };
            document.addEventListener('keydown', this.escKeyListener);
        });
    }

    closeConfirm() {
        if (this.overlay) {
            this.overlay.classList.remove('show');
            this.box.classList.remove('show');
            this.overlay.addEventListener('transitionend', () => {
                if (this.overlay && this.overlay.parentNode) {
                    document.body.removeChild(this.overlay);
                    this.isActive = false; // Allow new dialogs to be created
                }
            });
        }

        // Remove Esc key listener
        if (this.escKeyListener) {
            document.removeEventListener('keydown', this.escKeyListener);
            this.escKeyListener = null;
        }
    }
}

const existingImages = new Map(); // Store existing images with their seeds as keys
let isGeneratingNewImages = false;
let pendingUpdates = false;
let isCleared = false;
const customConfirm = new CustomConfirm();

function loadFormData() {
    fetch('/load_form_data')
    .then(response => response.json())
    .then(data => {
        savedData = data;
        const form = document.getElementById('generateForm');
        for (const [key, value] of Object.entries(data)) {
            const field = form.elements[key];
            if (field && ['TEXTAREA', 'SELECT', 'INPUT'].includes(field.tagName)) {
                if (field.tagName === 'SELECT') {
                    // Set the selected option for <select>
                    Array.from(field.options).forEach(option => {
                        option.selected = option.value === value;
                    });
                } else {
                    // Set the value for <textarea> and <input>
                    field.value = value;
                }
            }
        }
    })
}

function populateModels(data, select) {
    Object.entries(data).forEach(([modelName, modelData]) => {
        const option = document.createElement('option');
        option.value = modelData.path;
        option.dataset.cfg = modelData.cfg || 7;
        option.dataset.type = modelData.type || "SDXL";
        option.textContent = modelName;
        if (modelData.disabled) {
            option.disabled = true;
        }
        select.appendChild(option);
    });
}

function populateExamplePrompts(data, select) {
    data.examples.forEach(prompt => {
        const option = document.createElement('option');
        option.value = prompt;
        option.textContent = prompt;
        select.appendChild(option);
    });
}

function populateExampleSizes(data, select) {
    Object.entries(data).forEach(([sizeName, sizeDimensions]) => {
        const option = document.createElement('option');
        option.value = sizeDimensions.join('x'); // Format as "width x height"
        option.textContent = sizeName; // Display the size name
        select.appendChild(option);
    });
}

function populateSchedulers(data, select) {
    data.schedulers.forEach(scheduler => {
        const option = document.createElement('option');
        option.value = scheduler;
        option.textContent = scheduler;
        select.appendChild(option);
    });
}

loadJsonAndPopulateSelect('/static/json/models.json', 'model', populateModels);
loadJsonAndPopulateSelect('/static/json/examplePrompts.json', 'example_prompt', populateExamplePrompts);
loadJsonAndPopulateSelect('/static/json/dimensions.json', 'example_size', populateExampleSizes);
loadJsonAndPopulateSelect('/static/json/schedulers.json', 'scheduler', populateSchedulers);

loadFormData();

(async () => {
    await getTokenCount('negative_prompt', 'negative-prompt-token-counter');
    await getTokenCount('prompt', 'prompt-token-counter');
})();

function submitButtonOnClick(event) {
    event.preventDefault();

    // Clear existing images for new generation
    isGeneratingNewImages = true;
    existingImages.clear();
    document.getElementById('images').innerHTML = '';
    const formElement = document.getElementById('generateForm');
    saveFormData();

    // Prepare data for the server
    const formData = new FormData(formElement); // Use the form element here
    fetch('/generate', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        isGeneratingNewImages = false;
        console.log('Server response:', data);
    })
    .catch(error => {
        console.error('Error:', error);
        isGeneratingNewImages = false;
    });
}

function saveFormData() {
    const formDataToSave = {};
    const formElement = document.getElementById("generateForm"); // Explicitly get the form element
    Array.from(formElement.elements).forEach(field => {
        if (field.name && ['TEXTAREA', 'SELECT', 'INPUT'].includes(field.tagName)) {
            formDataToSave[field.name] = field.value;
        }
    });
    fetch('/save_form_data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formDataToSave)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Form data saved:', data);
    })
    .catch(error => {
        console.error('Error saving form data:', error);
    });
}

function resetCacheButtonOnClick(event) {
    const isConfirmed = customConfirm.createConfirm('Are you sure you want to reset the form cache?<br>this cannot be undone!',
        [
            { text: 'Reset', value: true },
            { text: 'Cancel', value: false }
        ],
        false
    );
    
    if (isConfirmed) {
        fetch('/reset_form_data', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            console.log('Form cache has been reset:', data);
            location.reload();
        })
        .catch(error => {
            console.error('Error resetting form cache:', error);
        });

        location.reload();

        console.log('Form cache has been reset.');
    }
};

setInterval(() => {
    if (document.visibilityState === 'visible' && !pendingUpdates && !isCleared) {
        pendingUpdates = true; // Prevent overlapping updates

        fetch('/status', { cache: 'no-store' })
            .then((response) => response.json())
            .then((data) => {
                document.getElementById('all').style.display = 'flex';

                updateProgressBars(data);

                processImageUpdates(data.images);

                updateImageScales();

                if (data.images.length < existingImages.size) {
                    existingImages.clear();
                    document.getElementById('images').innerHTML = '';
                }
            })
            .catch((error) => {
                console.error('Error fetching status:', error);
                document.getElementById('all').style.display = 'none';
            })
            .finally(() => {
                pendingUpdates = false;
                isCleared = false;
            });
    }
}, 2500);

function updateImageScales() {
    const images = document.querySelectorAll('#images img');
    const value = Number(document.getElementById('img_display_input').value); // Convert value to a number
    images.forEach(img => {
        img.style.width = `${100 / value - 4}vw`;
    });
}

document.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    customConfirm.createConfirm('Quick Actions', [
        { text: 'Clear Images', value: () => clearButtonOnClick(event) },
        { text: 'Stop Generation', value: () => stopButtonOnClick(event) },
        { text: 'Get Metadata', value: () => window.open(`metadata`) }
    ], true);
});

function updateProgressBars(data) {
    const progressText = document.getElementById('progress');
    const statusDiv = document.getElementById('status');
    const dynamicProgressBar = document.getElementById('dynamic-progress-bar');
    const alldynamicProgressBar = document.getElementById('all-dynamic-progress-bar');

    // Update progress value smoothly
    if (Number.isInteger(data.imgprogress)) {
        dynamicProgressBar.style.width = `calc(${data.imgprogress}%)`;
        progressText.innerHTML = `Progress: ${data.imgprogress}% Remaining: ${data.remainingimages}`;
        statusDiv.style.display = 'block';
    }
    else if (data.imgprogress === '') {
        statusDiv.style.display = 'none';
    }
    else {
        dynamicProgressBar.style.width = `0%`;
        alldynamicProgressBar.style.width = `0%`;
        progressText.innerHTML = `Progress: ${data.imgprogress.substring(0, 200)}`;
    }

    if (Number.isInteger(data.allpercentage)) {
        alldynamicProgressBar.style.width = `calc(${data.allpercentage}%)`;
    } else {
        alldynamicProgressBar.style.width = `0%`;
    }
}

async function getTokenCount(inElementID, outElementId) {
    const textarea = document.getElementById(inElementID);
    const text = textarea.value;
    const response = await fetch('/clip_token_count', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ text })
    });
    const result = await response.json();
    document.getElementById(outElementId).innerHTML = result['CLIP Token Count']
}

function getSizeSuffix() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const sizeMap = {
        'slow-2g': '?size=mini',
        '2g': '?size=mini',
        '3g': '?size=small',
        '4g': '?size=medium'
    };
    const typesWithSuffix = ['cellular', 'wimax', 'bluetooth', 'other', 'unknown', 'none'];

    if (connection) {
        if (connection.type === 'cellular' && connection.effectiveType === '4g') {
            return '?size=small';
        }
        if (typesWithSuffix.includes(connection.type)) {
            return sizeMap[connection.effectiveType] || '';
        }
    }
    return '';
}

function updateImageSizes() {
    existingImages.forEach((wrapper) => {
        const img = wrapper.querySelector('img');
        const imgData = img.src.split('?')[0];
        const sizeSuffix = getSizeSuffix();
        img.src = `${imgData}${sizeSuffix}`;
    });
}

if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
    (navigator.connection || navigator.mozConnection || navigator.webkitConnection).addEventListener('change', updateImageSizes);
}

function processImageUpdates(images) {
    const imagesDiv = document.getElementById('images');

    images.forEach((imgData, index) => {
        const key = imgData.seed;
        const sizeSuffix = getSizeSuffix();

        if (existingImages.has(key)) {
            const existingImg = existingImages.get(key).querySelector('img');
            if (existingImg.src !== imgData.img + sizeSuffix) {
                existingImg.src = imgData.img + sizeSuffix;
            }
        } else {
            const wrapper = document.createElement('div');
            wrapper.className = 'image-wrapper';

            const img = document.createElement('img');
            img.src = imgData.img + sizeSuffix;
            img.loading = "lazy";
            img.onclick = () => openLink("image/" + imgData.img.split('/').pop());

            wrapper.appendChild(img);
            imagesDiv.appendChild(wrapper);
            existingImages.set(key, wrapper);
            updateImageSizes();
        }
        if (index === images.length - 1) {
            const lastImg = existingImages.get(key)?.querySelector('img');
            if (lastImg) {
                lastImg.src = `${imgData.img + sizeSuffix}?timestamp=${Date.now()}`; // Force refresh
            }
        }
    });
}

function openLink(link) {
    window.open(link.split('?')[0]);
}

function savePrompt() {
    const prompt = document.getElementById('prompt').value;
    const negativePrompt = document.getElementById('negative_prompt').value;

    fetch('/save_prompt', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `prompt=${encodeURIComponent(prompt)}&negative_prompt=${encodeURIComponent(negativePrompt)}`
    })
        .then(response => response.json())
        .then(data => {
            console.log(data.status);
        })
        .catch(error => console.error('Error saving prompt:', error));
}

document.addEventListener('visibilitychange', function () {
    const state =
        document.visibilityState === 'visible'
            ? 'Vis'
            : document.visibilityState === 'hidden'
            ? 'Hid'
            : document.visibilityState === 'prerender'
            ? 'Pre'
            : 'Unk';
    document.title = `Image Generator (${state})`;
});

function stopButtonOnClick(event) {
    fetch('/stop', {
        method: 'POST'
    })
    .catch(error => console.error('Error stopping generation:', error));
};

function restartButtonOnClick(event) {
    const isConfirmed = customConfirm.createConfirm(
        'Are you sure you want to restart the server?\nIt will reset all variables and has a chance to fail restarting.',
        [
            { text: 'Restart', value: true },
            { text: 'Cancel', value: false }
        ],
        false
    );

    if (isConfirmed) {
        isCleared = true;
        fetch('/restart', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById('all').style.display = 'none';
        })
        .catch(error => console.error('Error stopping generation:', error));
    }
};

function clearButtonOnClick(event) {
    const isConfirmed = customConfirm.createConfirm(
        'Are you sure you want to clear all images?',
        [
            { text: 'Clear', value: true },
            { text: 'Cancel', value: false }
        ],
        false
    );

    if (isConfirmed) {
        fetch('/clear', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            existingImages.clear();
            document.getElementById('images').innerHTML = '';
        })
        .catch(error => console.error('Error Clearing Images:', error));
    }
};

//TODO handle prompt example change

const promptSelectElement = document.getElementById('example_prompt');
const promptTextareaElement = document.getElementById('prompt');

// Add an event listener for the 'change' event on the select element
promptSelectElement.addEventListener('change', function() {
    promptTextareaElement.value = promptSelectElement.value; // Update textarea with the selected prompt
});

//TODO handle model change

const modelSelectElement = document.getElementById('model');
const cfgInputElement = document.getElementById('cfg_scale');
const modelTypeInputElement = document.getElementById('model_type');

// Add an event listener for the 'change' event on the select element
modelSelectElement.addEventListener('change', function() {
    cfgInputElement.value = modelSelectElement.options[modelSelectElement.selectedIndex].dataset.cfg || 7;
    modelTypeInputElement.value = modelSelectElement.options[modelSelectElement.selectedIndex].dataset.type || "SDXL";
});

//TODO handle pre dimension change

// Assuming the following elements exist in your HTML
const exampleSizeSelectElement = document.getElementById('example_size');
const widthInputElement = document.getElementById('width');
const heightInputElement = document.getElementById('height');

// Add an event listener for the 'change' event on the example_size select element
exampleSizeSelectElement.addEventListener('change', function() {
    const selectedOption = exampleSizeSelectElement.options[exampleSizeSelectElement.selectedIndex];

    if (selectedOption) {
        // Parse the selected value to get width and height
        const dimensions = selectedOption.value.split('x'); // Assuming the value format is "widthxheight"
        if (dimensions.length === 2) {
            widthInputElement.value = dimensions[0]; // Set width
            heightInputElement.value = dimensions[1]; // Set height
        }
    }
});

// Optionally, set the initial values based on the first option in the select
if (exampleSizeSelectElement.options.length > 0) {
    const initialDimensions = exampleSizeSelectElement.options[0].value.split('x');
    widthInputElement.value = initialDimensions[0];
    heightInputElement.value = initialDimensions[1];
}