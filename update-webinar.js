// update-webinar.js
// Run from the project root: node update-webinar.js

const fs = require('fs');
const path = 'webinar/index.html';

if (!fs.existsSync(path)) {
  console.error('ERROR: ' + path + ' not found. Run this from the project root folder.');
  process.exit(1);
}

fs.copyFileSync(path, path + '.bak');
console.log('Backup saved as ' + path + '.bak');

let content = fs.readFileSync(path, 'utf8');
const hadCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n'); // normalize for reliable matching
content = content.replace(/Â·/g, '·'); // repair mojibake middle-dot corruption found in this file

// 1. Add script include right before the closing </body> tag
if (!content.includes('ghl-webhook.js')) {
  if (content.includes('</body>')) {
    content = content.replace('</body>', '<script src="assets/js/ghl-webhook.js"></script>\n</body>');
    console.log('Added script include.');
  } else {
    console.log('WARNING: could not find </body>. Script include NOT added automatically.');
  }
} else {
  console.log('Script include already present, skipping.');
}

// 2. Add honeypot field
const formOpen = '<form id="regForm" novalidate>';
const honeypot = '<input type="text" name="company_url" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off">';
if (!content.includes('name="company_url"')) {
  if (content.includes(formOpen)) {
    content = content.replace(formOpen, formOpen + '\n          ' + honeypot);
    console.log('Added honeypot field.');
  } else {
    console.log('WARNING: could not find the form tag. Honeypot NOT added automatically.');
  }
} else {
  console.log('Honeypot already present, skipping.');
}

// 3. Replace the submit handler
const oldHandler = `document.getElementById('regForm').addEventListener('submit',function(e){
  e.preventDefault();
  const fn=document.getElementById('fn').value.trim();
  const ln=document.getElementById('ln').value.trim();
  const em=document.getElementById('em').value.trim();
  const ph=document.getElementById('ph').value.trim();
  const props=document.getElementById('props').value;
  const s=getSelectedSession();
  if(!fn||!ln||!em||!ph){alert('Please fill in your name, email and mobile number.');return;}
  if(!/\\S+@\\S+\\.\\S+/.test(em)){alert('Please enter a valid email address.');return;}
  if(!s){alert('Please choose a session date.');return;}
  const {dayDate,time}=sessionLabel(s);
  const params=new URLSearchParams(window.location.search);
  const payload={firstName:fn,lastName:ln,email:em,mobile:ph,program:'webinar',sessionId:s.id,sessionDate:s.start,propertiesOwned:props,page:'webinar',leadSource: 'webinar lead',utm:{source:params.get('utm_source')||'',campaign:params.get('utm_campaign')||'',medium:params.get('utm_medium')||''}};
  fetch('/api/webinar-register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(function(response){return response.json().then(function(result){if(!response.ok||!result.ok) throw new Error();return result;});})
    .then(function(){
      document.getElementById('sessConfirm').textContent='Your session: '+dayDate+' · '+time;
      document.getElementById('formHead').style.display='none';
      document.getElementById('regForm').style.display='none';
      document.getElementById('formSuccess').style.display='block';
      document.getElementById('formCard').scrollIntoView({behavior:'smooth',block:'start'});
    })
    .catch(function(){alert('We could not complete your registration. Please try again.');});
});`;

const newHandler = `document.getElementById('regForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const form = e.target;
  if (isBotSubmission(form)) return;
  const fn=document.getElementById('fn').value.trim();
  const ln=document.getElementById('ln').value.trim();
  const em=document.getElementById('em').value.trim();
  const ph=document.getElementById('ph').value.trim();
  const props=document.getElementById('props').value;
  const s=getSelectedSession();
  if(!fn||!ln||!em||!ph){alert('Please fill in your name, email and mobile number.');return;}
  if(!/\\S+@\\S+\\.\\S+/.test(em)){alert('Please enter a valid email address.');return;}
  if(!s){alert('Please choose a session date.');return;}
  const {dayDate,time}=sessionLabel(s);

  const submitBtn = form.querySelector('.f-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registering…';

  const result = await postToGHL({
    firstName: fn, lastName: ln, email: em, phone: ph,
    program: 'webinar', sessionId: s.id, sessionDate: s.start,
    propertiesOwned: props, pageOfOrigin: 'webinar',
    leadSource: 'webinar lead'
  });

  if (result.ok) {
    document.getElementById('sessConfirm').textContent='Your session: '+dayDate+' · '+time;
    document.getElementById('formHead').style.display='none';
    document.getElementById('regForm').style.display='none';
    document.getElementById('formSuccess').style.display='block';
    document.getElementById('formCard').scrollIntoView({behavior:'smooth',block:'start'});
  } else {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Calculate My Wealth Gap — Free →';
    alert('We could not complete your registration. Please try again, or WhatsApp us and we\\'ll register you personally.');
  }
});`;

if (content.includes(oldHandler)) {
  content = content.replace(oldHandler, newHandler);
  console.log('Replaced submit handler.');
} else if (content.includes('postToGHL(')) {
  console.log('Submit handler already updated, skipping.');
} else {
  console.log('WARNING: could not find the exact old submit handler text. Your file may differ from what was expected. NO changes made to the submit handler.');
}

fs.writeFileSync(path, hadCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
console.log('');
console.log('Done. To undo everything: copy ' + path + '.bak back over ' + path);

