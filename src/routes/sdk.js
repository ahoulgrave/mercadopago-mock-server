const { Router } = require('express');

const router = Router();

/**
 * Serve a fake MercadoPago JS SDK at /js/v2.
 *
 * This mimics the real SDK's `MercadoPago` constructor and `cardForm()` method.
 * Instead of creating real iframes to MercadoPago's domain, it renders plain
 * HTML inputs and generates mock card tokens via the local mock server.
 */
router.get('/js/v2', (req, res) => {
  res.type('application/javascript');
  res.send(fakeSdk());
});

function fakeSdk() {
  return `
(function() {
  'use strict';

  var MOCK_BASE = window.__MP_MOCK_BASE || window.location.origin;

  function MercadoPago(publicKey, opts) {
    this.publicKey = publicKey;
    this.opts = opts || {};
  }

  MercadoPago.prototype.cardForm = function(config) {
    var formEl = document.getElementById(config.form.id);
    var cardNumberContainer = document.getElementById(config.form.cardNumber.id);
    var expirationContainer = document.getElementById(config.form.expirationDate.id);
    var securityCodeContainer = document.getElementById(config.form.securityCode.id);
    var cardholderNameInput = document.getElementById(config.form.cardholderName.id);
    var callbacks = config.callbacks || {};

    // Create real inputs inside the containers (instead of iframes)
    var cardNumberInput = createInput(cardNumberContainer, config.form.cardNumber.placeholder || '0000 0000 0000 0000', 'text');
    var expirationInput = createInput(expirationContainer, config.form.expirationDate.placeholder || 'MM/YY', 'text');
    var securityCodeInput = createInput(securityCodeContainer, config.form.securityCode.placeholder || 'CVV', 'text');

    // Card number formatting
    cardNumberInput.addEventListener('input', function() {
      var v = this.value.replace(/\\D/g, '').substring(0, 16);
      this.value = v.replace(/(\\d{4})(?=\\d)/g, '$1 ');
    });

    // Expiration formatting
    expirationInput.addEventListener('input', function() {
      var v = this.value.replace(/\\D/g, '').substring(0, 4);
      if (v.length >= 3) v = v.substring(0, 2) + '/' + v.substring(2);
      this.value = v;
    });

    // Security code
    securityCodeInput.addEventListener('input', function() {
      this.value = this.value.replace(/\\D/g, '').substring(0, 4);
    });

    // Token state
    var lastToken = null;

    // Hook form submission
    if (formEl) {
      formEl.addEventListener('submit', function(e) {
        e.preventDefault();

        var cardNumber = cardNumberInput.value.replace(/\\s/g, '');
        var expiration = expirationInput.value;
        var securityCode = securityCodeInput.value;
        var cardholderName = cardholderNameInput ? cardholderNameInput.value : '';

        // Basic validation
        var errors = [];
        if (cardNumber.length < 13) errors.push({ field: 'cardNumber', message: 'Invalid card number' });
        if (!/^\\d{2}\\/\\d{2}$/.test(expiration)) errors.push({ field: 'expirationDate', message: 'Invalid expiration date' });
        if (securityCode.length < 3) errors.push({ field: 'securityCode', message: 'Invalid security code' });

        if (errors.length > 0) {
          if (callbacks.onError) callbacks.onError(errors);
          return;
        }

        // Request a mock token from the server
        fetch(MOCK_BASE + '/v1/card_tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card_number: cardNumber,
            expiration_month: parseInt(expiration.split('/')[0]),
            expiration_year: 2000 + parseInt(expiration.split('/')[1]),
            security_code: securityCode,
            cardholder: { name: cardholderName },
            public_key: this.publicKey,
          }),
        })
        .then(function(res) { return res.json(); })
        .then(function(tokenData) {
          lastToken = tokenData.id;
          if (callbacks.onSubmit) {
            callbacks.onSubmit(e);
          }
        })
        .catch(function(err) {
          if (callbacks.onError) {
            callbacks.onError([{ message: 'Failed to create card token: ' + err.message }]);
          }
        });
      }.bind(this));
    }

    // Notify form mounted
    setTimeout(function() {
      if (callbacks.onFormMounted) callbacks.onFormMounted(null);
    }, 50);

    return {
      getCardFormData: function() {
        return {
          token: lastToken,
          payment_method_id: detectCardBrand(cardNumberInput.value.replace(/\\s/g, '')),
          issuer_id: '',
          installments: '1',
        };
      },
      unmount: function() {
        // Clean up injected inputs
        [cardNumberContainer, expirationContainer, securityCodeContainer].forEach(function(c) {
          if (c) c.innerHTML = '';
        });
      },
    };
  };

  function createInput(container, placeholder, type) {
    if (!container) return document.createElement('input');
    container.innerHTML = '';
    var input = document.createElement('input');
    input.type = type;
    input.placeholder = placeholder;
    input.style.cssText = 'width:100%;height:100%;border:none;outline:none;padding:0 12px;font-size:14px;font-family:inherit;background:transparent;';
    container.appendChild(input);
    return input;
  }

  function detectCardBrand(number) {
    if (/^4/.test(number)) return 'visa';
    if (/^5[1-5]/.test(number)) return 'master';
    if (/^3[47]/.test(number)) return 'amex';
    return 'visa';
  }

  // Expose globally like the real SDK
  window.MercadoPago = MercadoPago;
})();
`;
}

module.exports = router;
