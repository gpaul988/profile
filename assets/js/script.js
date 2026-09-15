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