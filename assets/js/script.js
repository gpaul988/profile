const btn = document.getElementById('button');
const form = document.getElementById('contact-form');

if (form && btn) {
    form.addEventListener('submit', function (event) {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        btn.textContent = 'Sending...';
        btn.disabled = true;

        const serviceID = 'default_service';
        const templateID = 'template_cdmu20h';

        emailjs.sendForm(serviceID, templateID, this)
            .then(() => {
                btn.textContent = 'Send Email';
                btn.disabled = false;
                form.reset();
                alert('Sent!');
            }, (err) => {
                btn.textContent = 'Send Email';
                btn.disabled = false;
                alert(JSON.stringify(err));
            });
    });
}