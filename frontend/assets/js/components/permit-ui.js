/**
 * =============================================================================
 * Permisos Digitales - Permit UI Enhancement (permit-ui.js)
 * =============================================================================
 *
 * Contains the JavaScript logic for the enhanced permit UI components:
 * - Multi-step form wizard
 * - Tabs navigation
 * - Enhanced file upload
 * - Timeline generation
 */

// --- Multi-step Form Wizard ---
function initFormWizard() {
    console.log('[PermitUI] Initializing form wizard...');

    const wizardSteps = document.querySelectorAll('.wizard-step');
    const wizardContents = document.querySelectorAll('.wizard-content');
    const nextButtons = document.querySelectorAll('.btn-next');
    const prevButtons = document.querySelectorAll('.btn-prev');
    const wizardProgress = document.querySelector('.wizard-progress');

    if (!wizardSteps.length || !wizardContents.length) {
        console.log('[PermitUI] No wizard elements found, skipping initialization.');
        return;
    }

    // Function to update progress indicator
    function updateProgressIndicator(stepNumber) {
        if (!wizardProgress) return;

        const totalSteps = wizardSteps.length;
        const progressPercentage = ((stepNumber - 1) / (totalSteps - 1)) * 100;

        // Update the progress line width
        wizardProgress.style.setProperty('--progress-width', `${progressPercentage}%`);

        // Add a class to indicate progress is active
        wizardProgress.classList.add('progress-active');
    }

    // Initialize progress indicator for the first step
    updateProgressIndicator(1);

    // Next button click handler with validation
    nextButtons.forEach(button => {
        button.addEventListener('click', () => {
            const nextStep = button.getAttribute('data-next');
            if (nextStep) {
                const currentStep = parseInt(button.closest('.wizard-content').getAttribute('data-step'));

                // Validate current step before proceeding
                if (validateStep(currentStep)) {
                    // Add success animation to the current step indicator
                    const currentStepIndicator = document.querySelector(`.wizard-step[data-step="${currentStep}"]`);
                    if (currentStepIndicator) {
                        currentStepIndicator.classList.add('step-success');
                        setTimeout(() => {
                            currentStepIndicator.classList.remove('step-success');
                        }, 1000);
                    }

                    goToStep(parseInt(nextStep));

                    // If we're going to the review step, populate the review data
                    if (nextStep === '3') {
                        populateReviewData();
                    }
                }
            }
        });
    });

    // Previous button click handler
    prevButtons.forEach(button => {
        button.addEventListener('click', () => {
            const prevStep = button.getAttribute('data-prev');
            if (prevStep) {
                goToStep(parseInt(prevStep));
            }
        });
    });

    // Function to validate a step before proceeding
    function validateStep(stepNumber) {
        // Get all required inputs in the current step
        const currentContent = document.querySelector(`.wizard-content[data-step="${stepNumber}"]`);
        if (!currentContent) return true;

        const requiredInputs = currentContent.querySelectorAll('input[required], textarea[required], select[required]');
        let isValid = true;

        // Check each required input
        requiredInputs.forEach(input => {
            if (!input.value.trim()) {
                isValid = false;
                input.classList.add('is-invalid');

                // Add shake animation
                input.classList.add('shake-animation');
                setTimeout(() => {
                    input.classList.remove('shake-animation');
                }, 600);

                // Show error message if there's an error span
                const errorSpan = document.getElementById(`${input.id}-error`);
                if (errorSpan) {
                    errorSpan.textContent = 'Este campo es obligatorio';
                    errorSpan.hidden = false;
                }

                // Focus the first invalid input
                if (isValid === false) {
                    setTimeout(() => input.focus(), 100);
                }
            }
        });

        return isValid;
    }

    // Function to go to a specific step
    function goToStep(stepNumber) {
        console.log(`[PermitUI] Going to step ${stepNumber}`);

        // Update progress indicator
        updateProgressIndicator(stepNumber);

        // Update step indicators with animation
        wizardSteps.forEach(step => {
            const stepNum = parseInt(step.getAttribute('data-step'));
            step.classList.remove('active', 'completed');

            if (stepNum === stepNumber) {
                // Add active class with a slight delay for better animation
                setTimeout(() => {
                    step.classList.add('active');
                }, 50);
            } else if (stepNum < stepNumber) {
                step.classList.add('completed');
            }
        });

        // Update content visibility with smooth transitions
        wizardContents.forEach(content => {
            const contentStep = parseInt(content.getAttribute('data-step'));

            if (content.classList.contains('active')) {
                // Fade out current content
                content.style.opacity = '0';
                content.style.transform = 'translateY(10px)';

                setTimeout(() => {
                    content.classList.remove('active');
                    content.style.opacity = '';
                    content.style.transform = '';

                    // Activate new content
                    if (contentStep === stepNumber) {
                        content.classList.add('active');
                    }
                }, 200);
            } else if (contentStep === stepNumber) {
                // Activate new content immediately
                content.classList.add('active');
            }
        });

        // Scroll to top of the form with a smooth animation
        const formWizard = document.querySelector('.form-wizard');
        if (formWizard) {
            formWizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // Function to populate review data from form inputs
    function populateReviewData() {
        console.log('[PermitUI] Populating review data...');

        // Applicant information
        updateReviewField('nombre-completo', 'review-nombre-completo');
        updateReviewField('curp-rfc', 'review-curp-rfc');
        updateReviewField('domicilio', 'review-domicilio');

        // Vehicle information
        updateReviewField('marca', 'review-marca');
        updateReviewField('linea', 'review-linea');
        updateReviewField('color', 'review-color');
        updateReviewField('ano-modelo', 'review-ano-modelo');
        updateReviewField('numero-serie', 'review-numero-serie');
        updateReviewField('numero-motor', 'review-numero-motor');

        // Add a subtle animation to the review items
        const reviewItems = document.querySelectorAll('.detail-list dd');
        reviewItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(10px)';

            setTimeout(() => {
                item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, 100 + (index * 50)); // Staggered animation
        });
    }

    // Helper function to update review fields
    function updateReviewField(inputId, reviewId) {
        const input = document.getElementById(`permit-${inputId}`);
        const reviewField = document.getElementById(reviewId);

        if (input && reviewField) {
            const value = input.value.trim();
            reviewField.textContent = value || '-';
        }
    }

    // Add input event listeners to clear validation errors
    const allInputs = document.querySelectorAll('.form-wizard input, .form-wizard textarea, .form-wizard select');
    allInputs.forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('is-invalid');
            const errorSpan = document.getElementById(`${input.id}-error`);
            if (errorSpan) {
                errorSpan.hidden = true;
                errorSpan.textContent = '';
            }
        });
    });

    console.log('[PermitUI] Enhanced form wizard initialized with animations and validation.');
}

// --- Tabs Navigation ---
function initTabs() {
    console.log('[PermitUI] Initializing tabs...');

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabsContainer = document.querySelector('.permit-tabs');

    if (!tabButtons.length || !tabContents.length || !tabsContainer) {
        console.log('[PermitUI] No tab elements found, skipping initialization.');
        return;
    }

    // Function to update the active indicator
    function updateActiveIndicator(activeButton) {
        // Get position and width of the active button
        const buttonRect = activeButton.getBoundingClientRect();
        const containerRect = tabsContainer.getBoundingClientRect();

        // Calculate the left position relative to the container
        const left = buttonRect.left - containerRect.left;
        const width = buttonRect.width;

        // Update the indicator position using the ::after pseudo-element
        tabsContainer.style.setProperty('--indicator-left', `${left}px`);
        tabsContainer.style.setProperty('--indicator-width', `${width}px`);

        // Make sure the indicator is visible
        tabsContainer.classList.add('has-indicator');
    }

    // Initialize the indicator for the initially active tab
    const initialActiveTab = document.querySelector('.tab-button.active');
    if (initialActiveTab) {
        // Use setTimeout to ensure the DOM is fully rendered
        setTimeout(() => updateActiveIndicator(initialActiveTab), 100);
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            // Update active tab button
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');

            // Update the active indicator
            updateActiveIndicator(button);

            // Update active tab content with a slight delay for better animation
            tabContents.forEach(content => {
                content.classList.remove('active');
            });

            // Small delay for better animation sequence
            setTimeout(() => {
                tabContents.forEach(content => {
                    if (content.getAttribute('data-tab') === tabId) {
                        content.classList.add('active');
                    }
                });
            }, 50);
        });
    });

    // Update indicator on window resize
    window.addEventListener('resize', () => {
        const activeTab = document.querySelector('.tab-button.active');
        if (activeTab) {
            updateActiveIndicator(activeTab);
        }
    });

    console.log('[PermitUI] Tabs initialized with animated indicator.');
}

// --- Enhanced File Upload ---
function initFileUpload() {
    console.log('[PermitUI] Initializing enhanced file upload...');

    const fileUploadContainer = document.getElementById('file-upload-container');
    const fileInput = document.getElementById('payment-proof-file');
    const fileNameDisplay = document.getElementById('file-name-display');
    const fileRemoveButton = document.getElementById('file-remove');

    if (!fileUploadContainer || !fileInput || !fileNameDisplay) {
        console.log('[PermitUI] File upload elements not found, skipping initialization.');
        return;
    }

    // Click on container to trigger file input
    fileUploadContainer.addEventListener('click', () => {
        fileInput.click();
    });

    // Handle file selection
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            displayFileName(file);
        }
    });

    // Handle drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileUploadContainer.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        fileUploadContainer.addEventListener(eventName, () => {
            fileUploadContainer.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileUploadContainer.addEventListener(eventName, () => {
            fileUploadContainer.classList.remove('dragover');
        }, false);
    });

    fileUploadContainer.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            fileInput.files = files;
            displayFileName(files[0]);
        }
    }, false);

    // Remove file
    if (fileRemoveButton) {
        fileRemoveButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering container click
            fileInput.value = '';
            fileNameDisplay.hidden = true;
            const uploadMessageDiv = document.getElementById('upload-message');
            if (uploadMessageDiv) {
                uploadMessageDiv.hidden = true;
            }
        });
    }

    // Helper to display file name
    function displayFileName(file) {
        const fileNameElement = fileNameDisplay.querySelector('.file-name');
        if (fileNameElement) {
            fileNameElement.textContent = file.name;
        }
        fileNameDisplay.hidden = false;

        // Clear any previous error messages
        const uploadMessageDiv = document.getElementById('upload-message');
        if (uploadMessageDiv) {
            uploadMessageDiv.hidden = true;
        }
    }

    console.log('[PermitUI] Enhanced file upload initialized.');
}

// --- Timeline Generation ---
function generateTimeline(applicationData) {
    console.log('[PermitUI] Generating timeline...');

    const timelineContainer = document.getElementById('permit-timeline');
    if (!timelineContainer || !applicationData) {
        console.log('[PermitUI] Timeline container or application data not found.');
        return;
    }

    // Clear existing timeline
    timelineContainer.innerHTML = '';

    // Define timeline steps based on application status
    const timelineSteps = [
        {
            title: 'Solicitud Creada',
            date: formatDate(applicationData.created_at),
            content: 'Su solicitud de permiso ha sido registrada en el sistema.',
            status: 'completed'
        }
    ];

    // Add payment proof step if applicable
    if (applicationData.payment_proof_uploaded_at) {
        timelineSteps.push({
            title: 'Comprobante Subido',
            date: formatDate(applicationData.payment_proof_uploaded_at),
            content: 'Su comprobante de pago ha sido subido y está pendiente de verificación.',
            status: 'completed'
        });
    } else if (['PENDING_PAYMENT', 'PROOF_REJECTED'].includes(applicationData.status)) {
        timelineSteps.push({
            title: 'Subir Comprobante',
            date: 'Pendiente',
            content: 'Es necesario subir un comprobante de pago para continuar con el proceso.',
            status: applicationData.status === 'PROOF_REJECTED' ? 'rejected' : 'pending'
        });
    }

    // Add verification step
    if (applicationData.payment_verified_at) {
        timelineSteps.push({
            title: 'Pago Verificado',
            date: formatDate(applicationData.payment_verified_at),
            content: 'Su pago ha sido verificado correctamente.',
            status: 'completed'
        });
    } else if (applicationData.payment_proof_uploaded_at) {
        timelineSteps.push({
            title: 'Verificación de Pago',
            date: 'En proceso',
            content: 'Su pago está siendo verificado por nuestro equipo.',
            status: applicationData.status === 'PROOF_REJECTED' ? 'rejected' : 'pending'
        });
    } else {
        timelineSteps.push({
            title: 'Verificación de Pago',
            date: 'Pendiente',
            content: 'Una vez subido el comprobante, nuestro equipo verificará su pago.',
            status: 'future'
        });
    }

    // Add permit issuance step
    if (['PERMIT_READY', 'COMPLETED'].includes(applicationData.status)) {
        timelineSteps.push({
            title: 'Permiso Emitido',
            date: formatDate(applicationData.permit_issued_at || applicationData.updated_at),
            content: 'Su permiso ha sido emitido y está listo para su descarga.',
            status: 'completed'
        });
    } else {
        timelineSteps.push({
            title: 'Emisión de Permiso',
            date: 'Pendiente',
            content: 'Una vez verificado el pago, se emitirá su permiso digital.',
            status: 'future'
        });
    }

    // Render timeline steps
    timelineSteps.forEach(step => {
        const timelineItem = document.createElement('div');
        timelineItem.className = `timeline-item ${step.status}`;

        timelineItem.innerHTML = `
            <div class="timeline-date">${step.date}</div>
            <div class="timeline-title">${step.title}</div>
            <div class="timeline-content">${step.content}</div>
        `;

        timelineContainer.appendChild(timelineItem);
    });

    console.log('[PermitUI] Timeline generated with ${timelineSteps.length} steps.');
}

// --- Helper Functions ---
function formatDate(dateString) {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Fecha inválida';

    return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// --- Make Functions Globally Accessible ---
window.initFormWizard = initFormWizard;
window.initTabs = initTabs;
window.initFileUpload = initFileUpload;
window.generateTimeline = generateTimeline;

console.log('[PermitUI] Permit UI enhancement script loaded.');
