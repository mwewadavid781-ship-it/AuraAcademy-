const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, university } = req.body;
    const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const { data, error } = await supabase.from('students').insert([{ 
      name, 
      email, 
      university, 
      trial_end_date: trialEndDate.toISOString(), 
      is_locked: false 
    }]).select();
    
    if (error) {
      console.log('SUPABASE ERROR:', error);
      return res.status(400).json({ error: error.message, details: error });
    }
    
    res.json({ success: true, student: data[0] });
  } catch (error) {
    console.log('CATCH ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    const { data, error } = await supabase.from('students').select('*').eq('email', email).single();
    
    if (error) {
      console.log('LOGIN ERROR:', error);
      return res.status(404).json({ error: error.message });
    }
    
    res.json({ success: true, student: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>AURA</title><style>*{margin:0;padding:0}body{font-family:sans-serif}#app{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea,#764ba2);padding:20px}.box{background:white;padding:40px;border-radius:16px;width:100%;max-width:400px}h1{color:#667eea;margin-bottom:20px}input,select{width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:6px}button{width:100%;background:#667eea;color:white;padding:12px;border:none;border-radius:6px;cursor:pointer;margin-top:10px}a{color:#667eea;cursor:pointer}.error{color:red;font-size:12px;margin-top:10px;padding:10px;background:#ffe0e0;border-radius:6px}</style></head><body><div id="app"><div class="box"><h1>📚 AURA</h1><div id="content"><form onsubmit="login(event)"><input type="email" id="email" placeholder="Email" required><input type="password" id="pass" placeholder="Password" required><button type="submit">Sign In</button></form><p style="margin-top:15px">New? <a onclick="showReg()">Create account</a></p></div></div></div><script>function login(e){e.preventDefault();const email=document.getElementById('email').value;fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}).then(r=>r.json()).then(d=>{if(d.success){alert('Welcome '+d.student.name);}else{alert('Error: '+d.error);}});}function showReg(){document.getElementById('content').innerHTML='<form onsubmit="register(event)"><input type="text" id="name" placeholder="Name" required><input type="email" id="regemail" placeholder="Email" required><select id="uni" required><option>UNZA</option><option>CBU</option><option>Mulungushi</option><option>LAMU</option></select><input type="password" id="regpass" placeholder="Password" required><button>Create Account</button></form><p><a onclick="location.reload()">Back</a></p>';}function register(e){e.preventDefault();const name=document.getElementById('name').value;const email=document.getElementById('regemail').value;const uni=document.getElementById('uni').value;fetch('/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,university:uni})}).then(r=>r.json()).then(d=>{console.log('Response:',d);if(d.success){alert('Account created! '+d.student.name);}else{alert('Error: '+(d.details?.message||d.error));}});}</script></body></html>`);
});

app.listen(PORT, () => console.log('🚀 AURA on ' + PORT));
