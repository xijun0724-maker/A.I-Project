(function(){
  const J=window.JourneyAI; const R=[];
  const ok=(l,c,e)=>R.push({label:l,ok:!!c,extra:e===undefined?'':String(e).slice(0,150)});
  J.Store.resetAll();
  J.UI.state.courseId='all'; J.UI.draft=null;
  const views=['dashboard','roadmap','tasks','planner','assistant','library','courses','settings','import'];
  const bad=[];
  views.forEach(v=>{
    try {
      J.App.navigate(v);
      const html=document.querySelector('#viewRoot').innerHTML;
      if(html.length<300) bad.push(v+':thin');
      if(/>undefined<|\[object Object\]|>NaN<|>null</.test(html)) bad.push(v+':bad value');
    } catch(e){ bad.push(v+':'+e.message); }
  });
  ok('every screen renders with an empty store', bad.length===0, bad.join(', '));
  const bandOut=document.querySelector('#viewRoot .band');
  J.App.navigate('dashboard');
  const band=document.querySelector('#viewRoot .band');
  ok('the week band survives an empty term', !!band && document.querySelector('.band-n').textContent.length>0,
     band?band.innerText.replace(/\n/g,' / ').slice(0,120):'no band');
  ok('empty states offer a way forward', /Import a syllabus|Add course|New task|Add documents/.test(document.querySelector('#viewRoot').innerText),
     document.querySelector('#viewRoot').innerText.slice(0,110).replace(/\n/g,' '));
  return R;
})()
