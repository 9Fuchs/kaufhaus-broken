document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/contact', { headers: { Accept: 'application/json' } })
        .then((response) => response.ok ? response.json() : Promise.reject())
        .then(({ email }) => {
            document.querySelectorAll('[data-contact-email]').forEach((element) => {
                element.textContent = email || 'Kontaktadresse nicht konfiguriert';
            });
        })
        .catch(() => {
            document.querySelectorAll('[data-contact-email]').forEach((element) => {
                element.textContent = 'Kontaktadresse momentan nicht verfügbar';
            });
        });

    document.querySelectorAll('[data-contact-form]').forEach((form) => {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const feedback = form.querySelector('[aria-live="polite"]');
            const values = Object.fromEntries(new FormData(form));
            const payload = form.id === 'feedback-form'
                ? {
                    name: values.Name,
                    replyEmail: values.EMail,
                    subject: `Standorthinweis: ${values.Standort}`,
                    message: `Standort: ${values.Standort}\n\nHinweis und Quelle:\n${values.Hinweis_und_Quelle}`,
                    website: values.website
                }
                : {
                    name: values.Name,
                    replyEmail: values.Antwortadresse,
                    subject: values.Betreff,
                    message: values.Nachricht,
                    website: values.website
                };

            if (feedback) feedback.textContent = 'Nachricht wird sicher übertragen …';
            fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(async (response) => {
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.error || 'Die Nachricht konnte nicht gesendet werden.');
                form.reset();
                if (feedback) feedback.textContent = 'Nachricht wurde übermittelt.';
            }).catch((error) => {
                if (feedback) feedback.textContent = error.message;
            });
        });
    });
});