const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, course, year } = req.body;
    const { data, error } = await supabase.from('students').insert([{
      name, email, university: 'Zambia', course_id: null, year,
      trial_end_date: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
      is_locked: false
    }]).select();
    if (error) throw error;
    await supabase.from('student_stats').insert([{ student_id: data[0].id, aura_points: 0, level: 1 }]);
    res.json({ success: true, student: { ...data[0], course } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    const { data, error } = await supabase.from('students').select('*').eq('email', email).single();
    if (error) throw error;
    const isCEO = email === 'mwewadavid781@gmail.com';
    res.json({ success: true, student: data, isCEO });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/groups/:course/:year', async (req, res) => {
  try {
    const { course, year } = req.params;
    const { data, error } = await supabase.from('study_groups').select('*').eq('course_id', course).eq('year', year);
    if (error) throw error;
    res.json({ groups: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/groups', async (req, res) => {
  try {
    const { course, year, groupName } = req.body;
    const { data, error } = await supabase.from('study_groups').insert([{
      course_id: course, year, group_name: groupName, description: `${groupName} - Year ${year}`
    }]).select();
    if (error) throw error;
    res.json({ success: true, group: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { groupId, studentId, messageText } = req.body;
    const { data, error } = await supabase.from('messages').insert([{
      group_id: groupId, student_id: studentId, message_text: messageText, message_type: 'text'
    }]).select();
    if (error) throw error;
    res.json({ success: true, message: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/messages/:groupId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('messages').select('*').eq('group_id', req.params.groupId).order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ messages: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/stats/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('student_stats').select('*').eq('student_id', req.params.studentId).single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const { data, error } = await supabase.from('student_stats').select('*').order('aura_points', { ascending: false }).limit(10);
    if (error) throw error;
    res.json({ leaderboard: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/ceo/unlock/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('students').update({
      is_locked: false,
      trial_end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString()
    }).eq('id', req.params.studentId).select();
    if (error) throw error;
    res.json({ success: true, student: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>AURA Dashboard</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a24;color:#f1f5f9;overflow-x:hidden}#starfield{position:fixed;top:0;left:0;width:100%;height:100%;z-index:1}#app{position:fixed;top:0;left:0;width:100%;height:100%;z-index:10;overflow-y:auto}input,select{width:100%;padding:12px;margin:8px 0;border:1.5px solid rgba(74,242,161,0.3);border-radius:10px;font-size:14px;background:rgba(10,10,36,0.4);color:#f1f5f9;font-family:inherit;backdrop-filter:blur(8px)}.btn{background:linear-gradient(135deg,#00FFCC,#4AF2A1);color:#0a0a24;padding:12px 24px;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:14px;box-shadow:0 0 15px rgba(74,242,161,0.4);transition:all 0.3s}.btn:hover{transform:translateY(-2px);box-shadow:0 0 25px rgba(74,242,161,0.6)}.hidden{display:none!important}.top-nav{background:rgba(10,10,36,0.5);padding:16px 24px;border-bottom:1.5px solid rgba(74,242,161,0.2);display:flex;justify-content:space-between;align-items:center;backdrop-filter:blur(10px);sticky:top 0}.logo{font-size:24px;font-weight:800;color:#f1f5f9;text-shadow:0 0 15px rgba(74,242,161,0.3)}.nav-stats{display:flex;gap:12px}.stat-badge{background:rgba(74,242,161,0.1);border:1px solid rgba(74,242,161,0.3);padding:8px 12px;border-radius:8px;font-size:12px;color:#4AF2A1;font-weight:600}.content{max-width:1200px;margin:0 auto;padding:24px;padding-bottom:120px}.section{display:none}.section.active{display:block}.page-title{font-size:32px;font-weight:800;color:#f1f5f9;margin-bottom:8px;text-shadow:0 0 20px rgba(74,242,161,0.3)}.page-sub{color:#cbd5e1;font-size:14px;margin-bottom:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}.card{background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:14px;padding:20px;backdrop-filter:blur(8px);transition:all 0.3s;cursor:pointer}.card:hover{border-color:rgba(74,242,161,0.4);box-shadow:0 0 25px rgba(74,242,161,0.2)}.card-icon{font-size:36px;margin-bottom:12px}.card-title{font-weight:700;color:#4AF2A1;margin-bottom:4px}.card-text{font-size:13px;color:#cbd5e1}.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-bottom:24px}.stat-card{background:rgba(74,242,161,0.1);border:1.5px solid rgba(74,242,161,0.2);border-radius:12px;padding:24px;text-align:center;backdrop-filter:blur(8px)}.stat-value{font-size:32px;font-weight:800;color:#4AF2A1;margin-bottom:8px}.stat-label{font-size:13px;color:#cbd5e1}.leaderboard{background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:14px;padding:20px;backdrop-filter:blur(8px)}.lb-item{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(74,242,161,0.1)}.lb-rank{font-weight:700;color:#4AF2A1;min-width:30px}.lb-name{flex:1;margin-left:12px}.lb-points{font-weight:700;color:#4AF2A1}.chat-container{height:400px;background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:12px;padding:16px;display:flex;flex-direction:column;backdrop-filter:blur(8px)}.messages{flex:1;overflow-y:auto;margin-bottom:12px;display:flex;flex-direction:column;gap:8px}.message{padding:12px;border-radius:8px;max-width:80%}.message.own{background:rgba(74,242,161,0.2);border:1px solid rgba(74,242,161,0.3);align-self:flex-end;color:#f1f5f9}.message.other{background:rgba(74,242,161,0.1);border:1px solid rgba(74,242,161,0.2);align-self:flex-start}.input-group{display:flex;gap:8px}.input-group input{flex:1}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:rgba(10,10,36,0.6);border-top:1.5px solid rgba(74,242,161,0.2);display:flex;justify-content:space-around;padding:8px 0;backdrop-filter:blur(10px);z-index:100}.nav-btn{background:none;border:none;color:#64748b;font-size:11px;cursor:pointer;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;transition:all 0.2s}.nav-btn.active{color:#4AF2A1;text-shadow:0 0 8px rgba(74,242,161,0.5)}</style></head><body><canvas id="starfield"></canvas><div id="app"><div class="top-nav"><div class="logo">📚 AURA</div><div class="nav-stats"><div class="stat-badge">L<span id="topLevel">1</span></div><div class="stat-badge"><span id="topPoints">0</span>pts</div><button class="btn" style="padding:6px 16px;font-size:12px" onclick="app.logout()">Logout</button></div></div><div class="content"><div id="home" class="section active"><div class="page-title">Welcome to AURA! 🎮</div><p class="page-sub">Your cyberpunk study journey begins</p><div class="stats-grid"><div class="stat-card"><div class="stat-value" id="hLevel">1</div><div class="stat-label">Level</div></div><div class="stat-card"><div class="stat-value" id="hPoints">0</div><div class="stat-label">AURA Points</div></div><div class="stat-card"><div class="stat-value" id="hBadges">0</div><div class="stat-label">Badges</div></div></div><div class="page-title" style="margin-top:40px;font-size:24px">Quick Actions 🚀</div><div class="grid"><div class="card" onclick="app.goTo('groups')"><div class="card-icon">👥</div><div class="card-title">Study Groups</div><div class="card-text">Connect with classmates in your course</div></div><div class="card" onclick="app.goTo('leaderboard')"><div class="card-icon">🏆</div><div class="card-title">Leaderboard</div><div class="card-text">See top students by AURA points</div></div><div class="card" onclick="app.goTo('profile')"><div class="card-icon">👤</div><div class="card-title">Profile</div><div class="card-text">View your stats and payment info</div></div></div></div><div id="groups" class="section"><div class="page-title">Study Groups 👥</div><p class="page-sub">Join your course cohort</p><div id="groupsList" class="grid"></div><button class="btn" style="margin-top:24px;width:100%;max-width:400px" onclick="app.showCreateGroup()">+ Create Group</button><div id="createGroupForm" class="hidden" style="margin-top:24px;background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:14px;padding:20px"><input type="text" id="groupName" placeholder="Group name" style="margin-bottom:12px"><button class="btn" style="width:100%" onclick="app.createGroup()">Create</button></div></div><div id="chat" class="section"><div class="page-title" id="chatTitle">Group Chat</div><p class="page-sub"><a onclick="app.goTo('groups')" style="color:#4AF2A1;cursor:pointer">← Back</a></p><div class="chat-container"><div class="messages" id="messagesList"></div><div class="input-group"><input type="text" id="messageInput" placeholder="Type message..."><button class="btn" onclick="app.sendMessage()">Send</button></div></div></div><div id="leaderboard" class="section"><div class="page-title">🏆 Top Students</div><p class="page-sub">Compete and climb the rankings</p><div class="leaderboard"><div id="leaderboardList"></div></div></div><div id="profile" class="section"><div class="page-title">👤 Your Profile</div><p class="page-sub">View your stats and manage account</p><div class="stats-grid"><div class="stat-card"><div class="stat-value" id="pLevel">1</div><div class="stat-label">Level</div></div><div class="stat-card"><div class="stat-value" id="pPoints">0</div><div class="stat-label">AURA Points</div></div><div class="stat-card"><div class="stat-value" id="pBadges">0</div><div class="stat-label">Badges Earned</div></div></div><div class="card"><div class="card-title" style="margin-bottom:12px">💳 Payment Info</div><div style="color:#cbd5e1;margin-bottom:12px"><strong>Plan:</strong> Premium (K10/week)</div><div style="color:#cbd5e1;margin-bottom:12px"><strong>Trial Ends:</strong> <span id="trialDate">7 days</span></div><div style="color:#cbd5e1"><strong>Payment Method:</strong> MTN Mobile Money (0964969767)</div></div></div></div></div><nav class="bottom-nav"><button class="nav-btn active" onclick="app.goTo('home')"><span style="font-size:20px">🏠</span>Home</button><button class="nav-btn" onclick="app.goTo('groups')"><span style="font-size:20px">👥</span>Groups</button><button class="nav-btn" onclick="app.goTo('leaderboard')"><span style="font-size:20px">🏆</span>Leaderboard</button><button class="nav-btn" onclick="app.goTo('profile')"><span style="font-size:20px">👤</span>Profile</button></nav></div><script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.143.0/build/three.module.js"}}</script><script type="module">import*as THREE from'three';const canvas=document.getElementById('starfield');const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(window.devicePixelRatio);renderer.setSize(window.innerWidth,window.innerHeight);renderer.setClearColor(0x0a0a24);const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,100);camera.position.z=5;const starsGeometry=new THREE.BufferGeometry();const count=4200;const depth=30;let positions=new Float32Array(count*3);let colors=new Float32Array(count*3);let sizes=new Float32Array(count);const colorA=new THREE.Color(0xaef6cf);const colorB=new THREE.Color(0x5fe6a0);const colorC=new THREE.Color(0xeafff2);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-0.5)*24;positions[i*3+1]=(Math.random()-0.5)*16;positions[i*3+2]=(Math.random()-0.5)*30;let palette=Math.floor(Math.random()*3);let color=palette===0?colorA:palette===1?colorB:colorC;let bright=0.7+Math.random()*0.6;colors[i*3]=color.r*bright;colors[i*3+1]=color.g*bright;colors[i*3+2]=color.b*bright;sizes[i]=0.5+Math.pow(Math.random(),1.4)*2.5;}starsGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));starsGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));starsGeometry.setAttribute('size',new THREE.BufferAttribute(sizes,1));const starsMaterial=new THREE.PointsMaterial({size:0.15,vertexColors:true,transparent:true,sizeAttenuation:true});const stars=new THREE.Points(starsGeometry,starsMaterial);scene.add(stars);let drift=0;let mouseX=0;let mouseY=0;document.addEventListener('mousemove',(e)=>{mouseX=(e.clientX/window.innerWidth)*2-1;mouseY=-(e.clientY/window.innerHeight)*2-1;});function animate(){requestAnimationFrame(animate);drift+=0.01;stars.position.z=drift%depth-depth/2;stars.rotation.z+=0.0001;camera.position.x=mouseX*2;camera.position.y=mouseY*2;camera.lookAt(0,0,0);renderer.render(scene,camera);}animate();</script><script>class App{constructor(){this.user=null;this.course=null;this.currentGroup=null;this.API=window.location.origin}async init(){const saved=localStorage.getItem('aura_user');if(saved){this.user=JSON.parse(saved);this.course=localStorage.getItem('aura_course');this.loadStats();this.loadGroups();this.loadLeaderboard()}else{window.location.href='/';}}async loadStats(){const res=await fetch(this.API+\`/api/stats/\${this.user.id}\`);const data=await res.json();const l=data.level||1;const p=data.aura_points||0;document.getElementById('topLevel').textContent=l;document.getElementById('topPoints').textContent=p;document.getElementById('hLevel').textContent=l;document.getElementById('hPoints').textContent=p;document.getElementById('pLevel').textContent=l;document.getElementById('pPoints').textContent=p;const trialEnd=new Date(this.user.trial_end_date);const daysLeft=Math.max(0,Math.ceil((trialEnd-new Date())/(1000*60*60*24)));document.getElementById('trialDate').textContent=daysLeft+' days'}async loadGroups(){const res=await fetch(this.API+\`/api/groups/\${this.course}/\${this.user.year}\`);const data=await res.json();const groups=data.groups||[];const html=groups.map(g=>\`<div class="card" onclick="app.enterGroup(\${g.id},'\\${g.group_name}')"><div class="card-icon">👥</div><div class="card-title">\${g.group_name}</div><div class="card-text">\${g.member_count||0} members</div></div>\`).join('');document.getElementById('groupsList').innerHTML=html||'<div class="card"><div class="card-text">No groups yet. Create one!</div></div>'}async loadLeaderboard(){const res=await fetch(this.API+'/api/leaderboard');const data=await res.json();const lb=data.leaderboard||[];const html=lb.map((s,i)=>\`<div class="lb-item"><div class="lb-rank">#\${i+1}</div><div class="lb-name">\${s.student_id}</div><div class="lb-points">\${s.aura_points}pts</div></div>\`).join('');document.getElementById('leaderboardList').innerHTML=html}enterGroup(id,name){this.currentGroup=id;document.getElementById('chatTitle').textContent=name;this.loadMessages();this.goTo('chat')}async loadMessages(){const res=await fetch(this.API+\`/api/messages/\${this.currentGroup}\`);const data=await res.json();const msgs=data.messages||[];const html=msgs.map(m=>\`<div class="message \${m.student_id===this.user.id?'own':'other'}">\${m.message_text}</div>\`).join('');document.getElementById('messagesList').innerHTML=html}async sendMessage(){const text=document.getElementById('messageInput').value;if(!text)return;await fetch(this.API+'/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupId:this.currentGroup,studentId:this.user.id,messageText:text})});document.getElementById('messageInput').value='';this.loadMessages()}showCreateGroup(){document.getElementById('createGroupForm').classList.toggle('hidden')}async createGroup(){const name=document.getElementById('groupName').value;if(!name)return;await fetch(this.API+'/api/groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({course:this.course,year:this.user.year,groupName:name})});document.getElementById('groupName').value='';this.showCreateGroup();this.loadGroups()}goTo(section){document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));document.getElementById(section).classList.add('active');event.target.closest('.nav-btn')?.classList.add('active')}logout(){localStorage.removeItem('aura_user');localStorage.removeItem('aura_course');window.location.href='/'}}const app=new App();app.init()</script></body></html>`);
});

app.listen(PORT, () => console.log('🚀 AURA PREMIUM DASHBOARD on ' + PORT));
