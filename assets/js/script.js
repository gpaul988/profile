const btn = document.querySelector('#contact-form button[type="submit"]');
const form = document.getElementById('contact-form');
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xjyvnjzn';

if (form && btn) {
    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        if (!FORMSPREE_ENDPOINT || FORMSPREE_ENDPOINT.includes('your-form-id')) {
            alert('Please add your Formspree form ID before deploying this site.');
            return;
        }

        btn.textContent = 'Sending...';
        btn.disabled = true;

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
            alert('Your message has been sent successfully.');
        } catch (error) {
            console.error('Formspree submission failed:', error);
            btn.textContent = 'Try Again';
            alert(error.message || 'Something went wrong while sending the message. Please try again.');
        } finally {
            btn.disabled = false;
        }
    });
}