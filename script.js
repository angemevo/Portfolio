/* ---- MOBILE NAV ---- */
(function(){
  const burger  = document.getElementById('burger');
  const overlay = document.getElementById('mobileOverlay');
  const mobLinks= document.querySelectorAll('.mob-link, .mob-cta');

  function openMenu(){
    burger.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow='hidden';
  }
  function closeMenu(){
    burger.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow='';
  }

  burger.addEventListener('click', ()=>{
    burger.classList.contains('open') ? closeMenu() : openMenu();
  });

  // Close on any link click
  mobLinks.forEach(link=>{
    link.addEventListener('click', closeMenu);
  });

  // Close on ESC
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape') closeMenu();
  });
})();

/* ---- CURSOR ---- */
const cur=document.getElementById('cur');
const curO=document.getElementById('cur-outer');
let mx=0,my=0,ox=0,oy=0;
document.addEventListener('mousemove',e=>{
  mx=e.clientX;my=e.clientY;
  cur.style.left=mx+'px';cur.style.top=my+'px';
});
(function animCursor(){
  ox+=(mx-ox)*.15;oy+=(my-oy)*.15;
  curO.style.left=ox+'px';curO.style.top=oy+'px';
  requestAnimationFrame(animCursor);
})();
const HOVER_SEL='a,button,.proj-card,.t-pill,.about-tag,.tl-card,.c-link';
document.addEventListener('mouseover',e=>{if(e.target.closest(HOVER_SEL))document.body.classList.add('hovering')});
document.addEventListener('mouseout',e=>{
  const from=e.target.closest(HOVER_SEL),to=e.relatedTarget&&e.relatedTarget.closest?e.relatedTarget.closest(HOVER_SEL):null;
  if(from&&!to)document.body.classList.remove('hovering');
});

/* ---- PROGRESS BAR ---- */
const pb=document.getElementById('progress-bar');
window.addEventListener('scroll',()=>{
  const p=window.scrollY/(document.body.scrollHeight-window.innerHeight)*100;
  pb.style.width=p+'%';
  document.getElementById('nav').classList.toggle('scrolled',window.scrollY>50);
});

/* ---- CODE BG removed — real photo in use ---- */

/* ---- SCROLL REVEAL ---- */
const revEls=document.querySelectorAll('.rev,.rev-l,.rev-r');
const ro=new IntersectionObserver(entries=>{
  entries.forEach((e,i)=>{
    if(e.isIntersecting){
      setTimeout(()=>e.target.classList.add('visible'),i*60);
      ro.unobserve(e.target);
    }
  });
},{threshold:.12});
revEls.forEach(r=>ro.observe(r));

/* ---- TIMELINE REVEAL ---- */
const tlItems=document.querySelectorAll('.tl-item');
const tlObs=new IntersectionObserver(entries=>{
  entries.forEach((e,i)=>{
    if(e.isIntersecting){
      setTimeout(()=>e.target.classList.add('visible'),i*150);
      tlObs.unobserve(e.target);
    }
  });
},{threshold:.2});
tlItems.forEach(t=>tlObs.observe(t));

/* ---- SKILL BARS ---- */
const fills=document.querySelectorAll('.sk-fill');
const skObs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.style.width=e.target.dataset.w+'%';
      skObs.unobserve(e.target);
    }
  });
},{threshold:.3});
fills.forEach(f=>skObs.observe(f));

/* ---- COUNTER ---- */
const counters=document.querySelectorAll('[data-count], .stat-mini-num[data-count]');
const coObs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      const end=+e.target.dataset.count;
      let n=0;const step=end/50;
      const t=setInterval(()=>{n+=step;if(n>=end){e.target.textContent=end+'+';clearInterval(t);}else e.target.textContent=Math.floor(n);},25);
      coObs.unobserve(e.target);
    }
  });
},{threshold:.5});
counters.forEach(c=>coObs.observe(c));

/* ---- CONTACT FORM FAKE SUBMIT ---- */
document.getElementById('cfBtn').addEventListener('click',function(){
  this.classList.add('sent');
  setTimeout(()=>this.classList.remove('sent'),3000);
});


/* ---- GAME EASTER EGG: Konami code unlocks game mode ---- */
const konamiCode=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let kIdx=0;
document.addEventListener('keydown',e=>{
  if(e.key===konamiCode[kIdx]){
    kIdx++;
    if(kIdx===konamiCode.length){
      kIdx=0;
      launchGameMode();
    }
  } else { kIdx=0; }
});

function launchGameMode(){
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;z-index:99998;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:JetBrains Mono,monospace;cursor:none;';
  overlay.innerHTML=`
    <canvas id="gameCanvas" width="400" height="500" style="border:1px solid rgba(255,77,28,.3);border-radius:4px"></canvas>
    <p style="color:rgba(255,255,255,.3);font-size:.65rem;letter-spacing:2px;margin-top:1rem">← → pour bouger · ESC pour quitter</p>
  `;
  document.body.appendChild(overlay);

  const gc=document.getElementById('gameCanvas');
  const gx=gc.getContext('2d');
  let gRunning=true;

  // Player
  const player={x:200,y:450,w:40,h:8,speed:6,color:'#ff4d1c'};
  // Ball
  const ball={x:200,y:250,r:7,vx:3,vy:-3,color:'#00e5c8'};
  // Bricks
  const bricks=[];
  const bCols=8,bRows=4;
  for(let r=0;r<bRows;r++){
    for(let c=0;c<bCols;c++){
      const colors=['#ff4d1c','#00e5c8','#ffc93d','#a855f7'];
      bricks.push({x:c*(46+4)+8,y:r*(18+5)+40,w:46,h:18,alive:true,color:colors[r]});
    }
  }
  let score=0;
  const keys={};
  document.addEventListener('keydown',e=>{keys[e.key]=true;if(e.key==='Escape'){gRunning=false;overlay.remove();}});
  document.addEventListener('keyup',e=>{keys[e.key]=false});

  function gameLoop(){
    if(!gRunning)return;
    gx.clearRect(0,0,400,500);

    // BG
    gx.fillStyle='#04050a';gx.fillRect(0,0,400,500);

    // Score
    gx.fillStyle='rgba(255,255,255,.3)';gx.font='500 12px JetBrains Mono';
    gx.fillText('SCORE: '+score,14,24);
    gx.fillText('MAG.GAME',300,24);

    // Player
    if(keys['ArrowLeft']&&player.x>0)player.x-=player.speed;
    if(keys['ArrowRight']&&player.x<400-player.w)player.x+=player.speed;
    const pg=gx.createLinearGradient(player.x,0,player.x+player.w,0);
    pg.addColorStop(0,'#ff4d1c');pg.addColorStop(1,'#ffc93d');
    gx.fillStyle=pg;
    gx.shadowBlur=15;gx.shadowColor='#ff4d1c';
    gx.beginPath();gx.roundRect(player.x,player.y,player.w,player.h,4);gx.fill();
    gx.shadowBlur=0;

    // Ball
    ball.x+=ball.vx;ball.y+=ball.vy;
    if(ball.x-ball.r<0||ball.x+ball.r>400)ball.vx*=-1;
    if(ball.y-ball.r<0)ball.vy*=-1;
    if(ball.y+ball.r>500){gRunning=false;overlay.remove();return;}
    // paddle hit
    if(ball.y+ball.r>player.y&&ball.x>player.x&&ball.x<player.x+player.w&&ball.vy>0){
      ball.vy*=-1;
      ball.vx=(ball.x-(player.x+player.w/2))/8;
    }
    // brick hits
    bricks.forEach(b=>{
      if(!b.alive)return;
      if(ball.x>b.x&&ball.x<b.x+b.w&&ball.y-ball.r<b.y+b.h&&ball.y+ball.r>b.y){
        b.alive=false;ball.vy*=-1;score+=10;
      }
    });

    gx.fillStyle=ball.color;
    gx.shadowBlur=20;gx.shadowColor=ball.color;
    gx.beginPath();gx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);gx.fill();
    gx.shadowBlur=0;

    // Draw bricks
    bricks.forEach(b=>{
      if(!b.alive)return;
      gx.fillStyle=b.color;
      gx.globalAlpha=.85;
      gx.shadowBlur=8;gx.shadowColor=b.color;
      gx.beginPath();gx.roundRect(b.x,b.y,b.w,b.h,3);gx.fill();
      gx.globalAlpha=1;gx.shadowBlur=0;
    });

    requestAnimationFrame(gameLoop);
  }
  gameLoop();
}