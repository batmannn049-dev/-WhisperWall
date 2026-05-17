/* =============================================
   js/auth.js — Login & OTP Authentication Logic
   WhisperWall Confession App
   ============================================= */

// ── EmailJS Credentials ──
const EMAILJS_SERVICE_ID  = 'service_zffvykd';
const EMAILJS_TEMPLATE_ID = 'template_xjkne7r';
const EMAILJS_PUBLIC_KEY  = '0YCxdlrPB7vAKSvXR';

// ── State ──
let generatedOTP   = '';
let countdownTimer = null;
let currentEmail   = '';
let currentName    = '';

// ── On Page Load ──
window.addEventListener('DOMContentLoaded', () => {
  const session = getSession();
  if (session && session.verified) {
    window.location.href = 'wall.html';
    return;
  }

  // ✅ Initialize EmailJS SDK with your Public Key
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

  setupOTPInputs();
});

// ── Step 1: Send OTP ──
async function sendOTP() {
  const nameInput  = document.getElementById('userName');
  const emailInput = document.getElementById('userEmail');
  const nameErr    = document.getElementById('nameError');
  const emailErr   = document.getElementById('emailError');
  const btn        = document.getElementById('sendOtpBtn');

  nameErr.textContent  = '';
  emailErr.textContent = '';

  const name  = nameInput.value.trim();
  const email = emailInput.value.trim();

  let valid = true;
  if (!name || name.length < 2) {
    nameErr.textContent = 'Please enter your name (at least 2 characters).';
    valid = false;
  }
  if (!isValidEmail(email)) {
    emailErr.textContent = 'Please enter a valid email address.';
    valid = false;
  }
  if (!valid) return;

  currentName  = name;
  currentEmail = email;

  generatedOTP = String(Math.floor(100000 + Math.random() * 900000));

  btn.disabled = true;
  btn.querySelector('span').textContent = 'Sending…';

  try {
    // ✅ Use EmailJS SDK — emailjs.send()
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        to_name:  name,
        to_email: email,
        otp_code: generatedOTP,
      }
    );

    showToast(`✉️ OTP sent to ${email}! Check your inbox & spam folder.`);
    switchStep('step1', 'step2');
    document.getElementById('otpEmailDisplay').textContent = email;
    startCountdown(60);

  } catch (err) {
    console.error('[WhisperWall] EmailJS error:', err);
    const detail = err && err.text ? err.text : (typeof err === 'string' ? err : JSON.stringify(err));
    emailErr.textContent = `Failed to send OTP — ${detail}. Check EmailJS template variables (to_name, to_email, otp_code) and that your Gmail service is connected.`;
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Send OTP';
  }
}

// ── Step 2: Verify OTP ──
function verifyOTP() {
  const inputs  = document.querySelectorAll('.otp-input');
  const entered = Array.from(inputs).map(i => i.value).join('');
  const otpErr  = document.getElementById('otpError');

  otpErr.textContent = '';

  if (entered.length < 6) {
    otpErr.textContent = 'Please enter all 6 digits.';
    shakeOTPBoxes();
    return;
  }

  if (entered !== generatedOTP) {
    otpErr.textContent = 'Incorrect OTP. Please try again.';
    shakeOTPBoxes();
    inputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
    inputs[0].focus();
    return;
  }

  saveSession({ name: currentName, email: currentEmail, verified: true });
  if (countdownTimer) clearInterval(countdownTimer);
  switchStep('step2', 'step3');
  document.getElementById('welcomeName').textContent = currentName;
  showToast('✅ Verified! Welcome to WhisperWall.');
}

// ── Step 3: Enter App ──
function enterApp() {
  window.location.href = 'wall.html';
}

// ── Go Back to Step 1 ──
function goBack() {
  if (countdownTimer) clearInterval(countdownTimer);
  switchStep('step2', 'step1');
  generatedOTP = '';
}

// ── Resend OTP ──
async function resendOTP() {
  generatedOTP = String(Math.floor(100000 + Math.random() * 900000));

  const resendBtn = document.getElementById('resendBtn');
  resendBtn.textContent = 'Sending…';
  resendBtn.disabled = true;

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        to_name:  currentName,
        to_email: currentEmail,
        otp_code: generatedOTP,
      }
    );
    showToast(`✉️ New OTP sent to ${currentEmail}!`);
  } catch (err) {
    console.error('[WhisperWall] Resend error:', err);
    showToast('❌ Failed to resend. Try again.');
  } finally {
    resendBtn.textContent = 'Resend OTP';
    resendBtn.disabled = false;
  }

  resendBtn.classList.add('hidden');
  document.getElementById('otpTimer').classList.remove('hidden');
  startCountdown(60);

  document.querySelectorAll('.otp-input').forEach(i => {
    i.value = '';
    i.classList.remove('filled', 'error');
  });
  document.getElementById('otpError').textContent = '';
  document.querySelectorAll('.otp-input')[0].focus();
}

// ── OTP Input Behaviour ──
function setupOTPInputs() {
  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val;
      if (val) {
        input.classList.add('filled');
        if (index < inputs.length - 1) inputs[index + 1].focus();
      } else {
        input.classList.remove('filled');
      }
      const allFilled = Array.from(inputs).every(i => i.value !== '');
      if (allFilled) setTimeout(verifyOTP, 200);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus();
        inputs[index - 1].value = '';
        inputs[index - 1].classList.remove('filled');
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData('text').replace(/\D/g, '').slice(0, 6);
      inputs.forEach((inp, i) => {
        inp.value = pasted[i] || '';
        if (inp.value) inp.classList.add('filled');
      });
      if (pasted.length === 6) setTimeout(verifyOTP, 200);
    });
  });
}

// ── Countdown Timer ──
function startCountdown(seconds) {
  let remaining = seconds;
  document.getElementById('countdown').textContent = remaining;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    remaining--;
    const el = document.getElementById('countdown');
    if (el) el.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      const timerEl   = document.getElementById('otpTimer');
      const resendBtn = document.getElementById('resendBtn');
      if (timerEl)   timerEl.classList.add('hidden');
      if (resendBtn) resendBtn.classList.remove('hidden');
    }
  }, 1000);
}

// ── Shake OTP Boxes ──
function shakeOTPBoxes() {
  document.querySelectorAll('.otp-input').forEach(i => {
    i.classList.add('error');
    setTimeout(() => i.classList.remove('error'), 500);
  });
}

// ── Switch Steps ──
function switchStep(from, to) {
  document.getElementById(from).classList.add('hidden');
  document.getElementById(to).classList.remove('hidden');
}

// ── Utilities ──
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function saveSession(data) {
  localStorage.setItem('ww_session', JSON.stringify(data));
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('ww_session')); }
  catch { return null; }
}

function showToast(msg, duration = 4000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}