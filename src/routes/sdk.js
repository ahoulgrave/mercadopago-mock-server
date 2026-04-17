const { Router } = require('express');

const router = Router();

/**
 * Serve a fake MercadoPago JS SDK at /js/v2.
 *
 * Implements the Fields API (mp.fields.create / mp.fields.createCardToken)
 * which is the officially recommended Core Methods integration.
 *
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

  // ─── Field Instance ──────────────────────────────────────────────────
  function FieldInstance(type, options) {
    this.type = type;
    this.options = options || {};
    this.input = null;
    this.container = null;
    this._listeners = {};
  }

  FieldInstance.prototype.mount = function(containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.warn('[MP Mock] Container not found: ' + containerId);
      return this;
    }
    this.container = container;
    container.innerHTML = '';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = this.options.placeholder || '';
    input.setAttribute('data-mp-field', this.type);
    input.style.cssText = 'width:100%;height:100%;border:none;outline:none;padding:0 12px;font-size:14px;font-family:inherit;background:transparent;box-sizing:border-box;';

    // Apply custom styles
    if (this.options.style) {
      Object.keys(this.options.style).forEach(function(key) {
        input.style[key] = this.options.style[key];
      }.bind(this));
    }

    // Input formatting and validation per field type
    if (this.type === 'cardNumber') {
      input.inputMode = 'numeric';
      input.maxLength = 19;
      input.addEventListener('input', function() {
        var v = this.value.replace(/\\D/g, '').substring(0, 16);
        this.value = v.replace(/(\\d{4})(?=\\d)/g, '$1 ');
      });
    } else if (this.type === 'expirationDate') {
      input.inputMode = 'numeric';
      input.maxLength = 5;
      input.addEventListener('input', function() {
        var v = this.value.replace(/\\D/g, '').substring(0, 4);
        if (v.length >= 3) v = v.substring(0, 2) + '/' + v.substring(2);
        this.value = v;
      });
    } else if (this.type === 'securityCode') {
      input.inputMode = 'numeric';
      input.maxLength = 4;
      input.addEventListener('input', function() {
        this.value = this.value.replace(/\\D/g, '').substring(0, 4);
      });
    } else if (this.type === 'expirationMonth') {
      input.inputMode = 'numeric';
      input.maxLength = 2;
    } else if (this.type === 'expirationYear') {
      input.inputMode = 'numeric';
      input.maxLength = 4;
    }

    // Track focus/blur events
    var self = this;
    input.addEventListener('focus', function() { self._emit('focus', { field: self.type }); });
    input.addEventListener('blur', function() { self._emit('blur', { field: self.type }); });
    input.addEventListener('input', function() { self._emit('change', { field: self.type }); });

    // BIN change detection for cardNumber
    if (this.type === 'cardNumber') {
      var lastBin = null;
      input.addEventListener('input', function() {
        var digits = this.value.replace(/\\D/g, '');
        var bin = digits.length >= 6 ? digits.substring(0, 6) : null;
        if (bin !== lastBin) {
          lastBin = bin;
          self._emit('binChange', { bin: bin, field: self.type });
        }
      });
    }

    container.appendChild(input);
    this.input = input;

    // Fire ready event async (like the real SDK does after iframe loads)
    setTimeout(function() { self._emit('ready', { field: self.type }); }, 50);

    return this;
  };

  FieldInstance.prototype.unmount = function() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.input = null;
    this.container = null;
    this._listeners = {};
  };

  FieldInstance.prototype.update = function(properties) {
    if (!this.input) return this;
    if (properties.placeholder) this.input.placeholder = properties.placeholder;
    return this;
  };

  FieldInstance.prototype.on = function(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return this;
  };

  FieldInstance.prototype._emit = function(event, data) {
    (this._listeners[event] || []).forEach(function(cb) {
      try { cb(data); } catch (e) { console.error('[MP Mock] Event handler error:', e); }
    });
  };

  // ─── Fields Module ───────────────────────────────────────────────────
  function FieldsModule(mp) {
    this._mp = mp;
    this._fields = {};
  }

  FieldsModule.prototype.create = function(type, options) {
    var field = new FieldInstance(type, options);
    this._fields[type] = field;
    return field;
  };

  FieldsModule.prototype.createCardToken = function(nonPCIData) {
    nonPCIData = nonPCIData || {};
    var fields = this._fields;
    var publicKey = this._mp.publicKey;

    // Read values from mounted fields
    var cardNumber = fields.cardNumber && fields.cardNumber.input
      ? fields.cardNumber.input.value.replace(/\\s/g, '')
      : '';

    var expiration = '';
    var expirationMonth = '';
    var expirationYear = '';

    if (fields.expirationDate && fields.expirationDate.input) {
      expiration = fields.expirationDate.input.value;
      var parts = expiration.split('/');
      expirationMonth = parts[0] || '';
      expirationYear = parts[1] ? String(2000 + parseInt(parts[1])) : '';
    } else {
      if (fields.expirationMonth && fields.expirationMonth.input) {
        expirationMonth = fields.expirationMonth.input.value;
      }
      if (fields.expirationYear && fields.expirationYear.input) {
        expirationYear = fields.expirationYear.input.value;
      }
    }

    var securityCode = fields.securityCode && fields.securityCode.input
      ? fields.securityCode.input.value
      : '';

    // Validate
    var errors = [];
    if (cardNumber.length < 13) errors.push({ message: 'cardNumber should be of length between 13 and 16.', cause: 'invalid_length' });
    if (!expirationMonth || parseInt(expirationMonth) < 1 || parseInt(expirationMonth) > 12) errors.push({ message: 'expirationMonth should be a value from 1 to 12.', cause: 'invalid_value' });
    if (!expirationYear || expirationYear.length < 4) errors.push({ message: 'expirationYear should be of length 4.', cause: 'invalid_length' });
    if (securityCode.length < 3) errors.push({ message: 'securityCode should be of length 3.', cause: 'invalid_length' });

    if (errors.length > 0) {
      // Emit error on relevant fields
      errors.forEach(function(err) {
        var fieldName = err.message.split(' ')[0];
        if (fields[fieldName]) {
          fields[fieldName]._emit('validityChange', { field: fieldName, errorMessages: [err] });
        }
      });
      return Promise.reject(errors);
    }

    // POST to mock server to create token
    return fetch(MOCK_BASE + '/v1/card_tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_number: cardNumber,
        expiration_month: parseInt(expirationMonth),
        expiration_year: parseInt(expirationYear),
        security_code: securityCode,
        cardholder: { name: nonPCIData.cardholderName || '' },
        identification_type: nonPCIData.identificationType || '',
        identification_number: nonPCIData.identificationNumber || '',
        public_key: publicKey,
      }),
    })
    .then(function(res) {
      if (!res.ok) {
        return res.json().then(function(err) { return Promise.reject(err); });
      }
      return res.json();
    });
  };

  FieldsModule.prototype.updateCardToken = function(token) {
    // In the mock, just create a new token
    return this.createCardToken({});
  };

  FieldsModule.prototype.focus = function() {
    var first = Object.values(this._fields)[0];
    if (first && first.input) first.input.focus();
  };

  FieldsModule.prototype.blur = function() {
    var first = Object.values(this._fields)[0];
    if (first && first.input) first.input.blur();
  };

  // ─── MercadoPago Constructor ─────────────────────────────────────────
  function MercadoPago(publicKey, opts) {
    this.publicKey = publicKey;
    this.opts = opts || {};
    this.fields = new FieldsModule(this);
  }

  // ─── Core Methods ────────────────────────────────────────────────────
  MercadoPago.prototype.getIdentificationTypes = function() {
    return Promise.resolve([
      { id: 'DNI', name: 'DNI', min_length: 7, max_length: 8, type: 'number' },
      { id: 'CUIT', name: 'CUIT', min_length: 11, max_length: 11, type: 'number' },
      { id: 'CUIL', name: 'CUIL', min_length: 11, max_length: 11, type: 'number' },
    ]);
  };

  MercadoPago.prototype.getPaymentMethods = function(params) {
    var bin = (params && params.bin) || '';
    var brand = detectCardBrand(bin);
    return Promise.resolve({
      results: [{
        id: brand,
        name: brand.charAt(0).toUpperCase() + brand.slice(1),
        payment_type_id: 'credit_card',
        status: 'active',
        secure_thumbnail: '',
        thumbnail: '',
        additional_info_needed: ['cardholder_name'],
        settings: [{
          card_number: { length: 16, validation: 'standard' },
          security_code: { length: 3, mode: 'mandatory' },
        }],
        issuer: { id: '1', name: 'Mock Bank' },
      }],
    });
  };

  MercadoPago.prototype.getIssuers = function(params) {
    return Promise.resolve([
      { id: '1', name: 'Mock Bank' },
    ]);
  };

  MercadoPago.prototype.getInstallments = function(params) {
    return Promise.resolve([{
      payment_method_id: 'visa',
      payment_type_id: 'credit_card',
      issuer: { id: '1', name: 'Mock Bank' },
      payer_costs: [
        { installments: 1, installment_rate: 0, recommended_message: '1 cuota de $ ' + ((params && params.amount) || '0') },
      ],
    }]);
  };

  MercadoPago.prototype.createCardToken = function(data) {
    return fetch(MOCK_BASE + '/v1/card_tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_number: data.cardNumber,
        expiration_month: parseInt(data.cardExpirationMonth),
        expiration_year: parseInt(data.cardExpirationYear),
        security_code: data.securityCode,
        cardholder: { name: data.cardholderName || '' },
        identification_type: data.identificationType || '',
        identification_number: data.identificationNumber || '',
        public_key: this.publicKey,
      }),
    })
    .then(function(res) { return res.json(); });
  };

  // ─── Legacy cardForm (kept for backwards compat) ─────────────────────
  MercadoPago.prototype.cardForm = function(config) {
    var formEl = document.getElementById(config.form.id);
    var cardNumberContainer = document.getElementById(config.form.cardNumber.id);
    var expirationContainer = document.getElementById(config.form.expirationDate.id);
    var securityCodeContainer = document.getElementById(config.form.securityCode.id);
    var cardholderNameInput = document.getElementById(config.form.cardholderName.id);
    var callbacks = config.callbacks || {};
    var publicKey = this.publicKey;

    var cardNumberInput = createInput(cardNumberContainer, config.form.cardNumber.placeholder || '', 'text');
    var expirationInput = createInput(expirationContainer, config.form.expirationDate.placeholder || '', 'text');
    var securityCodeInput = createInput(securityCodeContainer, config.form.securityCode.placeholder || '', 'text');

    cardNumberInput.addEventListener('input', function() {
      var v = this.value.replace(/\\D/g, '').substring(0, 16);
      this.value = v.replace(/(\\d{4})(?=\\d)/g, '$1 ');
    });
    expirationInput.addEventListener('input', function() {
      var v = this.value.replace(/\\D/g, '').substring(0, 4);
      if (v.length >= 3) v = v.substring(0, 2) + '/' + v.substring(2);
      this.value = v;
    });
    securityCodeInput.addEventListener('input', function() {
      this.value = this.value.replace(/\\D/g, '').substring(0, 4);
    });

    var lastToken = null;

    if (formEl) {
      formEl.addEventListener('submit', function(e) {
        e.preventDefault();
        var cardNumber = cardNumberInput.value.replace(/\\s/g, '');
        var expiration = expirationInput.value;
        var securityCode = securityCodeInput.value;
        var cardholderName = cardholderNameInput ? cardholderNameInput.value : '';
        var errors = [];
        if (cardNumber.length < 13) errors.push({ field: 'cardNumber', message: 'Invalid card number' });
        if (!/^\\d{2}\\/\\d{2}$/.test(expiration)) errors.push({ field: 'expirationDate', message: 'Invalid expiration date' });
        if (securityCode.length < 3) errors.push({ field: 'securityCode', message: 'Invalid security code' });
        if (errors.length > 0) { if (callbacks.onError) callbacks.onError(errors); return; }

        fetch(MOCK_BASE + '/v1/card_tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card_number: cardNumber,
            expiration_month: parseInt(expiration.split('/')[0]),
            expiration_year: 2000 + parseInt(expiration.split('/')[1]),
            security_code: securityCode,
            cardholder: { name: cardholderName },
            public_key: publicKey,
          }),
        })
        .then(function(res) { return res.json(); })
        .then(function(tokenData) {
          lastToken = tokenData.id;
          if (callbacks.onSubmit) callbacks.onSubmit(e);
        })
        .catch(function(err) {
          if (callbacks.onError) callbacks.onError([{ message: 'Failed to create card token: ' + err.message }]);
        });
      });
    }

    setTimeout(function() { if (callbacks.onFormMounted) callbacks.onFormMounted(null); }, 50);

    return {
      getCardFormData: function() {
        return { token: lastToken, payment_method_id: detectCardBrand(cardNumberInput.value.replace(/\\s/g, '')), issuer_id: '', installments: '1' };
      },
      createCardToken: function() {
        if (formEl) formEl.requestSubmit();
      },
      unmount: function() {
        [cardNumberContainer, expirationContainer, securityCodeContainer].forEach(function(c) { if (c) c.innerHTML = ''; });
      },
    };
  };

  // ─── Helpers ─────────────────────────────────────────────────────────
  function createInput(container, placeholder, type) {
    if (!container) return document.createElement('input');
    container.innerHTML = '';
    var input = document.createElement('input');
    input.type = type;
    input.placeholder = placeholder;
    input.style.cssText = 'width:100%;height:100%;border:none;outline:none;padding:0 12px;font-size:14px;font-family:inherit;background:transparent;box-sizing:border-box;';
    container.appendChild(input);
    return input;
  }

  function detectCardBrand(number) {
    if (/^4/.test(number)) return 'visa';
    if (/^5[1-5]/.test(number)) return 'master';
    if (/^3[47]/.test(number)) return 'amex';
    return 'visa';
  }

  window.MercadoPago = MercadoPago;
})();
`;
}

module.exports = router;
