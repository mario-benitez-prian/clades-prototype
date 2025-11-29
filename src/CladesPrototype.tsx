import React, { useEffect, useMemo, useState } from 'react';

type Taxonomy = {
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  species: string;
};

type Species = {
  id: string;
  display: string;
  sci: string;
  taxonomy: Taxonomy;
};

type LastResult = {
  points: number;
  corrects: Record<keyof Taxonomy, boolean>;
  expected: Taxonomy;
};

const SPECIES: Species[] = [
  { id: 'homo_sapiens', display: 'Humano', sci: 'Homo sapiens', taxonomy:{phylum:'Chordata',class:'Mammalia',order:'Primates',family:'Hominidae',genus:'Homo',species:'Homo sapiens'}},
  { id: 'balaenoptera_musculus', display: 'Ballena azul', sci: 'Balaenoptera musculus', taxonomy:{phylum:'Chordata',class:'Mammalia',order:'Cetartiodactyla',family:'Balaenopteridae',genus:'Balaenoptera',species:'Balaenoptera musculus'}},
  { id: 'loxodonta_africana', display: 'Elefante africano', sci: 'Loxodonta africana', taxonomy:{phylum:'Chordata',class:'Mammalia',order:'Proboscidea',family:'Elephantidae',genus:'Loxodonta',species:'Loxodonta africana'}},
  { id: 'panthera_tigris', display: 'Tigre', sci: 'Panthera tigris', taxonomy:{phylum:'Chordata',class:'Mammalia',order:'Carnivora',family:'Felidae',genus:'Panthera',species:'Panthera tigris'}},
  { id: 'ailuropoda_melanoleuca', display: 'Oso panda gigante', sci: 'Ailuropoda melanoleuca', taxonomy:{phylum:'Chordata',class:'Mammalia',order:'Carnivora',family:'Ursidae',genus:'Ailuropoda',species:'Ailuropoda melanoleuca'}},
  { id: 'monodon_monoceros', display: 'Narval', sci: 'Monodon monoceros', taxonomy:{phylum:'Chordata',class:'Mammalia',order:'Cetartiodactyla',family:'Monodontidae',genus:'Monodon',species:'Monodon monoceros'}},
  { id: 'carcharodon_carcharias', display: 'Tiburón blanco', sci: 'Carcharodon carcharias', taxonomy:{phylum:'Chordata',class:'Chondrichthyes',order:'Lamniformes',family:'Lamnidae',genus:'Carcharodon',species:'Carcharodon carcharias'}},
  { id: 'haliaeetus_leucocephalus', display: 'Águila calva', sci: 'Haliaeetus leucocephalus', taxonomy:{phylum:'Chordata',class:'Aves',order:'Accipitriformes',family:'Accipitridae',genus:'Haliaeetus',species:'Haliaeetus leucocephalus'}},
  { id: 'falco_peregrinus', display: 'Halcón peregrino', sci: 'Falco peregrinus', taxonomy:{phylum:'Chordata',class:'Aves',order:'Falconiformes',family:'Falconidae',genus:'Falco',species:'Falco peregrinus'}},
  { id: 'danaus_plexippus', display: 'Mariposa monarca', sci: 'Danaus plexippus', taxonomy:{phylum:'Arthropoda',class:'Insecta',order:'Lepidoptera',family:'Nymphalidae',genus:'Danaus',species:'Danaus plexippus'}}
];

const RANKS: (keyof Taxonomy)[] = ['phylum','class','order','family','genus','species'];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CladesPrototype(){
  const [remaining, setRemaining] = useState<Species[]>(() => shuffle(SPECIES.slice()));
  const [current, setCurrent] = useState<Species | null>(() => remaining[0] || null);
  const [answers, setAnswers] = useState<Taxonomy>({phylum:'',class:'',order:'',family:'',genus:'',species:''});
  const [score, setScore] = useState<number>(0);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string|null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  const optionsByRank = useMemo(()=>{
    const out: Record<keyof Taxonomy, string[]> = {} as Record<keyof Taxonomy, string[]>;
    RANKS.forEach(r => {
      out[r] = Array.from(new Set(SPECIES.map(s => s.taxonomy[r]))).sort();
    });
    return out;
  },[]);

  useEffect(()=>{
    if(current) fetchImage(current.sci);
  },[current]);

  function fetchImage(title: string){
    setLoadingImage(true); setImageUrl(null);
    const encoded = encodeURIComponent(title);
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    fetch(url)
      .then(r=>r.json())
      .then(j=>{
        if(j && j.thumbnail && j.thumbnail.source) setImageUrl(j.thumbnail.source);
        else if(j && j.originalimage && j.originalimage.source) setImageUrl(j.originalimage.source);
        else setImageUrl(null);
      })
      .catch(()=>setImageUrl(null))
      .finally(()=>setLoadingImage(false));
  }

  function handleInput(rank: keyof Taxonomy, value: string){
    setAnswers(prev => ({...prev, [rank]: value}));
  }

  function submit(){
    if(!current) return;
    let points = 0; 
    const corrects: Record<keyof Taxonomy, boolean> = {} as Record<keyof Taxonomy, boolean>;

    RANKS.forEach(rank=>{
      const expected = current.taxonomy[rank];
      const given = (answers[rank] || '').trim();
      if(!given){ corrects[rank] = false; return; }
      if(rank === 'species'){
        const expLower = expected.toLowerCase();
        const givenLower = given.toLowerCase();
        if(givenLower === expLower || givenLower === expected.split(' ').slice(-1)[0].toLowerCase()){ points+=1; corrects[rank]=true; return; }
      }
      if(given.toLowerCase() === expected.toLowerCase()){ points+=1; corrects[rank]=true; return; }
      corrects[rank] = false;
    });

    setScore(s => s + points);
    setLastResult({points, corrects, expected: current.taxonomy});

    setRemaining(prev=>{
      const next = prev.filter(p => p.id !== current.id);
      if(next.length===0){ setCurrent(null); return []; }
      const pick = next[Math.floor(Math.random()*next.length)];
      setCurrent(pick);
      setAnswers({phylum:'',class:'',order:'',family:'',genus:'',species:''});
      return next;
    });
  }

  function showSolution(){ if(current) setAnswers(current.taxonomy); }
  function reset(){ 
    const fresh = shuffle(SPECIES.slice());
    setRemaining(fresh);
    setCurrent(fresh[0] || null);
    setAnswers({phylum:'',class:'',order:'',family:'',genus:'',species:''});
    setScore(0);
    setLastResult(null);
  }

  // Styles (same que antes)
 // Simple style block (original)
const style = `:root{--bg:#f7fbff;--card:#ffffff;--accent:#3b82f6;--muted:#6b7280}
.wrap{max-width:640px;margin:18px auto;padding:12px;font-family:Inter,system-ui,Segoe UI,Helvetica,Arial,sans-serif}
.card{background:var(--card);border-radius:12px;box-shadow:0 6px 18px rgba(20,30,60,0.06);padding:14px}
header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
h1{font-size:18px;margin:0}
.meta{color:var(--muted);font-size:13px}
.image{width:100%;height:220px;border-radius:10px;overflow:hidden;background:linear-gradient(180deg,#e6f0ff,#fff);display:flex;align-items:center;justify-content:center}
img{width:100%;height:100%;object-fit:cover}
label{font-size:12px;color:var(--muted);display:block;margin-bottom:6px}
input{width:100%;padding:10px;border-radius:8px;border:1px solid #e6e9ef;font-size:14px}
.row{display:flex;gap:8px;margin-top:8px}
.col{flex:1}
.controls{display:flex;gap:8px;margin-top:6px}
button{background:var(--accent);color:white;border:0;padding:10px 14px;border-radius:10px;font-weight:600}
.ghost{background:transparent;color:var(--accent);border:1px solid rgba(59,130,246,0.12)}
.small{font-size:13px;color:var(--muted)}
`;

  if(!current){
    return (
      <div className="wrap">
        <style>{style}</style>
        <div className="card">
          <h1>CLADES — Prototipo</h1>
          <p className="small">Se han completado las especies. Puntuación final: <strong>{score}</strong></p>
          <div style={{marginTop:12}}>
            <button onClick={reset}>Reiniciar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <style>{style}</style>
      <div className="card">
        <header>
          <div style={{flex:1}}>
            <h1>CLADES — Prototipo</h1>
            <div className="meta">Especie: <strong>{current.display}</strong> — {current.sci}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div className="small">Score: <strong>{score}</strong></div>
            <div className="small">Restantes: {remaining.length}</div>
          </div>
        </header>

        <div className="image">
          {loadingImage ? <div className="small">Cargando imagen…</div> : (
            imageUrl ? <img src={imageUrl} alt={current.display} /> : <div className="small">Sin imagen disponible desde Wikipedia para <strong>{current.sci}</strong></div>
          )}
        </div>

        <div style={{marginTop:12}}>
          {RANKS.map(rank=> (
            <div className="row" key={rank}>
              <div className="col">
                <label>{rank.charAt(0).toUpperCase()+rank.slice(1)}</label>
                <input value={answers[rank] || ''} onChange={(e)=>handleInput(rank, e.target.value)} placeholder={rank} />
                <div className="controls">
                  <button className="ghost" onClick={(e)=>{
                    e.preventDefault();
                    const q = prompt('Sugerencias para '+rank+' (escribe para filtrar)\n\nOpciones: '+(optionsByRank[rank]||[]).slice(0,10).join(', '));
                    if(q) handleInput(rank,q);
                  }}>Sugerencias</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button onClick={submit}>Enviar respuesta</button>
          <button className="ghost" onClick={showSolution}>Mostrar solución</button>
        </div>

        {lastResult && (
          <div style={{marginTop:10,fontWeight:700}}>
            Resultado: {lastResult.points} puntos en esta ronda.
            <div className="small" style={{marginTop:6}}>
              Respuestas correctas por rango:
              <ul>
                {RANKS.map(r=> <li key={r}>{r}: {lastResult.corrects[r] ? '✓' : '✕'} (esperado: {lastResult.expected[r]})</li>)}
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
