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
            setFormStatus('Thanks for reaching out. Your message has been sent successfully and I will get back to you within 24–48 hours.', 'success');
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
const openProjectButton = document.getElementById('open-project-intake');
const closeProjectButton = document.getElementById('close-project-intake');
const projectForm = document.getElementById('project-intake-form');
const projectStatus = document.getElementById('project-intake-status');
let lastFocusedElement;

const setProjectStatus = (message, type) => {
    if (!projectStatus) {
        return;
    }

    projectStatus.className = 'form-status';
    projectStatus.classList.add(type === 'success' ? 'is-success' : 'is-error');
    projectStatus.textContent = message;
};

const closeProjectModal = () => {
    if (!projectModal) {
        return;
    }

    projectModal.hidden = true;
    document.body.classList.remove('project-modal-open');
    if (lastFocusedElement) {
        lastFocusedElement.focus();
    }
};

if (projectModal && openProjectButton && closeProjectButton && projectForm) {
    openProjectButton.addEventListener('click', () => {
        lastFocusedElement = document.activeElement;
        projectModal.hidden = false;
        document.body.classList.add('project-modal-open');
        projectForm.querySelector('input')?.focus();
    });

    closeProjectButton.addEventListener('click', closeProjectModal);
    projectModal.addEventListener('click', (event) => {
        if (event.target.hasAttribute('data-close-project-modal')) {
            closeProjectModal();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !projectModal.hidden) {
            closeProjectModal();
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
            const response = await fetch(FORMSPREE_ENDPOINT, {
                method: 'POST',
                body: new FormData(projectForm),
                headers: { Accept: 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Your enquiry could not be sent.');
            }

            projectForm.reset();
            submitButton.textContent = 'Sent';
            setProjectStatus('Thanks — your project enquiry has been sent successfully.', 'success');
        } catch (error) {
            console.error('Project enquiry submission failed:', error);
            submitButton.textContent = 'Try Again';
            setProjectStatus('Something went wrong. Please try again or email graham@grahamspaul.net.ng directly.', 'error');
        } finally {
            submitButton.disabled = false;
        }
    });
}