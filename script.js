document.addEventListener('DOMContentLoaded',()=>{
  const form=document.getElementById('loginForm');
  const user=document.getElementById('user');
  const pass=document.getElementById('pass');
  const msg=document.getElementById('formMessage');

  form.addEventListener('submit',e=>{
    e.preventDefault();
    msg.textContent='';
    if(!user.value.trim()||!pass.value.trim()){
      msg.textContent='Please enter username and password.';
      return;
    }

    // Simulate network/login
    const btn=document.getElementById('submitBtn');
    btn.disabled=true;btn.textContent='Signing in...';
    setTimeout(()=>{
      btn.disabled=false;btn.textContent='Sign In';
      msg.style.color='green';
      msg.textContent='Signed in successfully (demo). Redirecting...';
      setTimeout(()=>{ msg.textContent=''; },1200);
    },1100);
  });
});
