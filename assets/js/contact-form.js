(function () {
  var form = document.getElementById('contactForm');
  if (!form) return;

  var status = document.getElementById('formStatus');
  var submitBtn = form.querySelector('button[type="submit"]');
  var portalId = form.getAttribute('data-hs-portal-id');
  var formId = form.getAttribute('data-hs-form-id');
  var endpoint = 'https://api.hsforms.com/submissions/v3/integration/submit/' + portalId + '/' + formId;

  function setStatus(message, isError) {
    status.textContent = message;
    status.className = 'form-status' + (isError ? ' form-status-error' : ' form-status-success');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setStatus('', false);

    var name = form.name.value.trim();
    var spaceIndex = name.indexOf(' ');
    var firstname = spaceIndex === -1 ? name : name.slice(0, spaceIndex);
    var lastname = spaceIndex === -1 ? '' : name.slice(spaceIndex + 1).trim();

    var fields = [
      { name: 'firstname', value: firstname },
      { name: 'lastname', value: lastname },
      { name: 'email', value: form.email.value.trim() },
      { name: 'message', value: form.message.value.trim() }
    ];
    if (form.org.value.trim()) fields.push({ name: 'company', value: form.org.value.trim() });
    if (form.segment.value) fields.push({ name: 'ab_client_segment', value: form.segment.value });
    if (form.urgency.value) fields.push({ name: 'ab_enquiry_urgency', value: form.urgency.value });

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: fields,
        context: {
          pageUri: window.location.href,
          pageName: document.title
        }
      })
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Submission failed');
        form.reset();
        setStatus("Thanks — we've received your message and will be in touch within two business days.", false);
      })
      .catch(function () {
        setStatus('Something went wrong sending your message. Please email us directly at hello@acaciablue.com.au instead.', true);
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send message';
      });
  });
})();
