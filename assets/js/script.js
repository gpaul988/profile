const btn = document.querySelector('#contact-form button[type="submit"]');
const form = document.getElementById('contact-form');
const formStatus = document.getElementById('form-status');
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xjyvnjzn';

const setFormStatus = (message, type) => {
    if (!formStatus) {
        return;
    }

    formStatus.className = 'form-status';
    formStatus.classList.add(type === 'success' ? 'is-success' : 'is-error');
    formStatus.textContent = message;
};

if (form && btn) {
    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        if (!FORMSPREE_ENDPOINT || FORMSPREE_ENDPOINT.includes('your-form-id')) {
            setFormStatus('Please add your Formspree form ID before deploying this site.', 'error');
            return;
        }

        btn.textContent = 'Sending...';
        btn.disabled = true;
        setFormStatus('Sending your message...', 'success');

        try {
            const response = await fetch(FORMSPREE_ENDPOINT, {
                method: 'POST',
                body: new FormData(form),
                headers: {
                    Accept: 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData?.error || 'Your message could not be sent. Please try again.');
            }

            btn.textContent = 'Sent';
            form.reset();
            setFormStatus('Thanks for reaching out. Your message has been sent successfully. I will review your enquiry and reply with clear next steps.', 'success');
        } catch (error) {
            console.error('Formspree submission failed:', error);
            btn.textContent = 'Try Again';
            setFormStatus('Something went wrong while sending your message. Please try again or email me directly at graham@grahamspaul.net.ng.', 'error');
        } finally {
            btn.disabled = false;
        }
    });
}

const projectModal = document.getElementById('project-intake-modal');
const openProjectButtons = document.querySelectorAll('[data-open-project-intake]');
const closeProjectButton = document.getElementById('close-project-intake');
const projectForm = document.getElementById('project-intake-form');
const projectStatus = document.getElementById('project-intake-status');
const projectEmailInput = document.getElementById('intake-email');
const projectReplyToInput = document.getElementById('intake-reply-to');
const referralSourceInput = document.getElementById('intake-referral');
const referralDetails = document.getElementById('intake-referral-details');
const welcomeOfferModal = document.getElementById('welcome-offer-modal');
const welcomeOfferCloseButtons = document.querySelectorAll('[data-close-welcome-offer], #close-welcome-offer, #dismiss-welcome-offer');
const welcomeOfferReopenButton = document.getElementById('reopen-welcome-offer');
const offerCodeInput = document.getElementById('intake-offer-code');
const welcomeOfferStorageKey = 'graham-welcome-offer-state';
let lastFocusedElement;

const readWelcomeOfferState = () => {
    try {
        return window.sessionStorage.getItem(welcomeOfferStorageKey);
    } catch (error) {
        if (error instanceof DOMException && error.name === 'SecurityError') {
            console.warn('Welcome offer dismissal could not be saved in this browser session.', error);
            return null;
        }
        throw error;
    }
};

const saveWelcomeOfferState = (state) => {
    try {
        window.sessionStorage.setItem(welcomeOfferStorageKey, state);
    } catch (error) {
        if (error instanceof DOMException && (error.name === 'SecurityError' || error.name === 'QuotaExceededError')) {
            console.warn('Welcome offer state could not be saved in this browser session.', error);
            return;
        }
        throw error;
    }
};

const getWelcomeOfferFocusableElements = () => Array.from(welcomeOfferModal?.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
) ?? []).filter((element) => !element.closest('[hidden]'));

const closeWelcomeOffer = (showReopenButton = true) => {
    if (!welcomeOfferModal) {
        return;
    }

    welcomeOfferModal.hidden = true;
    document.body.classList.remove('welcome-offer-open');
    if (welcomeOfferReopenButton) {
        welcomeOfferReopenButton.hidden = !showReopenButton;
        if (showReopenButton) {
            welcomeOfferReopenButton.focus();
        }
    }
};

const openWelcomeOffer = () => {
    if (!welcomeOfferModal) {
        return;
    }

    welcomeOfferModal.hidden = false;
    document.body.classList.add('welcome-offer-open');
    if (welcomeOfferReopenButton) {
        welcomeOfferReopenButton.hidden = true;
    }
    welcomeOfferModal.querySelector('#close-welcome-offer')?.focus();
};

if (welcomeOfferModal && welcomeOfferReopenButton) {
    const savedWelcomeOfferState = readWelcomeOfferState();
    if (savedWelcomeOfferState !== 'dismissed' && savedWelcomeOfferState !== 'claimed') {
        window.setTimeout(() => {
            if (projectModal && !projectModal.hidden) {
                welcomeOfferReopenButton.hidden = false;
                return;
            }
            openWelcomeOffer();
        }, 1200);
    } else {
        welcomeOfferReopenButton.hidden = false;
    }

    welcomeOfferCloseButtons.forEach((button) => {
        button.addEventListener('click', () => {
            saveWelcomeOfferState('dismissed');
            closeWelcomeOffer();
        });
    });

    welcomeOfferReopenButton.addEventListener('click', openWelcomeOffer);
}

const setProjectStatus = (message, type) => {
    if (!projectStatus) {
        return;
    }

    projectStatus.className = 'form-status';
    projectStatus.classList.add(type === 'success' ? 'is-success' : 'is-error');
    projectStatus.textContent = message;
};

const getSubmissionError = async (response, fallbackMessage) => {
    const responseText = await response.text();
    if (responseText) {
        try {
            const data = JSON.parse(responseText);
            if (data.errors && Array.isArray(data.errors)) {
                const messages = data.errors
                    .map((item) => item && item.message)
                    .filter(Boolean)
                    .join(' ');
                if (messages) {
                    return messages;
                }
            }
            if (data.error) {
                return data.error;
            }
        } catch {
            if (responseText.length < 240) {
                return responseText;
            }
        }
    }

    return fallbackMessage;
};

const closeProjectModal = () => {
    if (!projectModal) {
        return;
    }

    projectModal.hidden = true;
    document.body.classList.remove('project-modal-open');
    if (lastFocusedElement?.isConnected) {
        lastFocusedElement.focus();
    }
};

if (projectModal && openProjectButtons.length > 0 && closeProjectButton && projectForm) {
    const getModalFocusableElements = () => Array.from(projectModal.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => !element.closest('[hidden]'));

    const openProjectModal = (event) => {
        const claimingWelcomeOffer = event.currentTarget.hasAttribute('data-claim-welcome-offer');
        lastFocusedElement = claimingWelcomeOffer ? welcomeOfferReopenButton : document.activeElement;
        if (claimingWelcomeOffer) {
            saveWelcomeOfferState('claimed');
            closeWelcomeOffer(true);
            if (referralSourceInput) {
                referralSourceInput.value = 'Website welcome offer';
                referralSourceInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (offerCodeInput) {
                offerCodeInput.value = 'WELCOME20';
            }
        } else if (offerCodeInput) {
            offerCodeInput.value = '';
        }
        projectModal.hidden = false;
        document.body.classList.add('project-modal-open');
        projectForm.querySelector('#intake-name')?.focus();
        event.currentTarget.blur();
    };

    openProjectButtons.forEach((button) => button.addEventListener('click', openProjectModal));

    closeProjectButton.addEventListener('click', closeProjectModal);
    projectModal.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.hasAttribute('data-close-project-modal')) {
            closeProjectModal();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (welcomeOfferModal && !welcomeOfferModal.hidden) {
            if (event.key === 'Escape') {
                saveWelcomeOfferState('dismissed');
                closeWelcomeOffer();
                return;
            }

            if (event.key === 'Tab') {
                const focusableElements = getWelcomeOfferFocusableElements();
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (firstElement && event.shiftKey && document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                } else if (lastElement && !event.shiftKey && document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
            return;
        }

        if (projectModal.hidden) {
            return;
        }

        if (event.key === 'Escape') {
            closeProjectModal();
        } else if (event.key === 'Tab') {
            const focusableElements = getModalFocusableElements();
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (!firstElement || !lastElement) {
                event.preventDefault();
                projectModal.querySelector('.project-modal__dialog')?.focus();
            } else if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    });

    referralSourceInput?.addEventListener('change', () => {
        if (referralDetails) {
            referralDetails.hidden = referralSourceInput.value !== 'Referral';
        }
    });

    projectForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!projectForm.checkValidity()) {
            projectForm.reportValidity();
            return;
        }

        const submitButton = projectForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
        setProjectStatus('Sending your project details...', 'success');

        try {
            if (projectEmailInput && projectReplyToInput) {
                projectReplyToInput.value = projectEmailInput.value;
            }
            const projectEndpoint = projectForm.getAttribute('action') || FORMSPREE_ENDPOINT;
            const response = await fetch(projectEndpoint, {
                method: 'POST',
                body: new FormData(projectForm),
                headers: {
                    Accept: 'application/json'
                }
            });

            if (!response.ok) {
                const message = await getSubmissionError(
                    response,
                    'Formspree rejected the enquiry. Please check the required fields and try again.'
                );
                throw new Error(message);
            }

            projectForm.reset();
            submitButton.textContent = 'Sent';
            setProjectStatus('Thank you for sharing your project vision. Your enquiry has been received successfully. I will review it and reply with clear next steps.', 'success');
            setTimeout(closeProjectModal, 1800);
        } catch (error) {
            console.error('Project enquiry submission failed:', error);
            submitButton.textContent = 'Try Again';
            setProjectStatus(error.message || 'Something went wrong. Please try again or email graham@grahamspaul.net.ng directly.', 'error');
        } finally {
            submitButton.disabled = false;
        }
    });
}