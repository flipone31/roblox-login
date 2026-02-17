document.addEventListener('DOMContentLoaded',()=>{
  const form=document.getElementById('loginForm');
  const user=document.getElementById('user');
  const pass=document.getElementById('pass');
  const msg=document.getElementById('formMessage');

  const topSearch = document.getElementById('topSearch');
  const topSearchForm = document.querySelector('.search');
  if(topSearchForm){
    topSearchForm.addEventListener('submit', (ev)=>{
      ev.preventDefault();
      const q = topSearch.value.trim();
      if(!q) return;
      msg.style.color = 'var(--muted)';
      msg.textContent = `Search for "${q}" (demo)`;
      setTimeout(()=> msg.textContent='',1400);
    });
  }

  form.addEventListener('submit',e=>{
    e.preventDefault();
    msg.textContent='';
    if(!user.value.trim()||!pass.value.trim()){
      msg.textContent='Please enter username and password.';
      return;
    }

    // POST login to server (stores hashed password in DB) - demo only
    const btn=document.getElementById('submitBtn');
    btn.disabled=true;btn.textContent='Signing in...';
    fetch('/api/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username: user.value, password: pass.value })
    }).then(r=>r.json()).then(data=>{
      btn.disabled=false;btn.textContent='Log In';
      if(data && data.ok){
        msg.style.color='green';
        msg.textContent='Signed in (demo).';
      } else {
        msg.style.color='crimson';
        msg.textContent = data && data.message ? data.message : 'Sign in failed';
      }
      setTimeout(()=>{ msg.textContent=''; },1200);
    }).catch(err=>{
      btn.disabled=false;btn.textContent='Log In';
      msg.style.color='crimson';
      msg.textContent='Network error';
      console.error(err);
      setTimeout(()=>{ msg.textContent=''; },1200);
    });
  });
  
  // small focus ripple for inputs
  document.querySelectorAll('input').forEach(i=>{
    i.addEventListener('focus',()=> i.classList.add('focused'))
    i.addEventListener('blur',()=> i.classList.remove('focused'))
  })
});
