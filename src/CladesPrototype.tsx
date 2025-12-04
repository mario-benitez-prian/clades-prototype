import React, { useEffect, useMemo, useState } from 'react';

//
// ------------------- TYPESCRIPT TYPES -------------------
//

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

// --- statistics for localStorage ---
type PerSpeciesStats = {
  attempts: number;
  correctFull: number; // number of times all ranks correct
  correctByRank: Record<keyof Taxonomy, number>; // counts of corrects by rank
};

type AllStats = Record<string, PerSpeciesStats>; // keyed by species.id

const STORAGE_KEY = 'clades_stats_v1';

// --- sample species list ---
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

//
// ------------------- UTILS -------------------
//

// shuffle an array (Fisher-Yates)
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// initialize empty per-species stats
function makeEmptyPerSpeciesStats(): PerSpeciesStats {
  const byRank = {} as Record<keyof Taxonomy, number>;
  RANKS.forEach(r => byRank[r] = 0);
  return { attempts:0, correctFull:0, correctByRank: byRank };
}

/**
 * ------------------- CORE FUNCTION -------------------
 * Decide the next species to show, using spaced repetition:
 * - Never-played species: weight = 1
 * - Played species: weight proportional to (1 - accuracy)
 */
function getNextSpecies(
  speciesList: Species[],
  stats: AllStats,
  currentId?: string
): Species {
  const weights = speciesList.map(species => {
    if(species.id === currentId) return 0; // no repetir la misma especie inmediatamente
    const sStats = stats[species.id];
    if(!sStats) return 1; // no jugada

    const totalRanks = RANKS.length;
    const correctCount = Object.values(sStats.correctByRank).reduce((a,b)=>a+b,0);
    const accuracy = correctCount / (sStats.attempts * totalRanks);
    return 1 + (1 - accuracy) * 5; // más fallo = más probabilidad de aparecer
  });

  const totalWeight = weights.reduce((a,b)=>a+b,0);
  const r = Math.random() * totalWeight;
  let sum = 0;
  for(let i=0;i<speciesList.length;i++){
    sum += weights[i];
    if(r <= sum) return speciesList[i];
  }
  return speciesList[speciesList.length-1];
}

//
// ------------------- MAIN COMPONENT -------------------
//

export default function CladesPrototype() {
  // ------------------- STATES -------------------
  const [screen, setScreen] = useState<'home'|'game'|'profile'>('home');

  const [current, setCurrent] = useState<Species | null>(null);
  const [answers, setAnswers] = useState<Taxonomy>({phylum:'',class:'',order:'',family:'',genus:'',species:''});
  const [score, setScore] = useState(0);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const [imageUrl, setImageUrl] = useState<string|null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  const [stats, setStats] = useState<AllStats>(()=>{
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    const base: AllStats = {};
    SPECIES.forEach(s => base[s.id] = makeEmptyPerSpeciesStats());
    return base;
  });

  const [wikiInfo,setWikiInfo] = useState<Record<string,{text:string;image?:string}>>({});
  const [popupVisible,setPopupVisible] = useState<Record<string,boolean>>({});

  // ------------------- DERIVED DATA -------------------
  const optionsByRank = useMemo(()=>{
    const out: Record<keyof Taxonomy,string[]> = {} as any;
    RANKS.forEach(r => {
      out[r] = Array.from(new Set(SPECIES.map(s=>s.taxonomy[r]))).sort();
    });
    return out;
  },[]);

  const profileData = useMemo(()=>{
    // processed stats for profile screen
    const playedSpecies = Object.values(stats).filter(s=>s.attempts>0).length;
    const speciesCorrectAll = Object.values(stats).filter(s=>s.correctFull>0).length;

    let rankTotals: Record<keyof Taxonomy,{correct:number, attempts:number}> = {} as any;
    RANKS.forEach(r=>rankTotals[r]={correct:0,attempts:0});
    Object.values(stats).forEach(s=>{
      RANKS.forEach(r=>{
        rankTotals[r].correct += s.correctByRank[r];
        rankTotals[r].attempts += s.attempts;
      });
    });

    const rankPct: Record<keyof Taxonomy,number> = {} as any;
    RANKS.forEach(r=>rankPct[r]=rankTotals[r].attempts? (rankTotals[r].correct/rankTotals[r].attempts)*100:0);

    // list of species with mistakes (fallidos)
    const failedSpeciesList = SPECIES.map(sp=>{
      const s = stats[sp.id];
      const attempts = s.attempts;
      const correctCount = RANKS.reduce((acc,r)=>acc+(s.correctByRank[r]>0?1:0),0);
      const hasAnyMistake = attempts>0 && correctCount<RANKS.length;
      return { species: sp, attempts, correctCount, hasAnyMistake };
    }).filter(x=>x.hasAnyMistake).sort((a,b)=>a.correctCount-b.correctCount);

    return { playedSpecies, totalSpecies: SPECIES.length, speciesCorrectAll, rankPct, failedSpeciesList };
  },[stats]);

  // ------------------- EFFECTS -------------------
  useEffect(()=>{
    if(current) fetchImage(current.sci);
  },[current]);

  useEffect(()=>{
    try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(stats)); }catch(e){}
  },[stats]);

  // ------------------- HANDLERS -------------------
  function fetchImage(title:string){
    setLoadingImage(true); setImageUrl(null);
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      .then(res=>res.json())
      .then(j=>{
        if(j.thumbnail?.source) setImageUrl(j.thumbnail.source);
        else if(j.originalimage?.source) setImageUrl(j.originalimage.source);
        else setImageUrl(null);
      })
      .catch(()=>setImageUrl(null))
      .finally(()=>setLoadingImage(false));
  }

  function handleInput(rank: keyof Taxonomy, value:string){
    setAnswers(prev=>{
      if(rank==='genus'){
        return { ...prev, genus:value, species: prev.species===prev.genus?value:prev.species };
      } else if(rank==='species'){
        const firstWord = value.split(' ')[0];
        return { ...prev, species:value, genus: prev.genus===prev.species?firstWord:prev.genus };
      } else return { ...prev, [rank]:value };
    });
  }

  function togglePopup(rank: keyof Taxonomy){
    if(!current) return;
    const cat = current.taxonomy[rank];
    if(!cat) return;
    const visible = popupVisible[cat];
    setPopupVisible(prev=>({...prev,[cat]:!visible}));

    if(!wikiInfo[cat] && !visible){
      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cat)}`)
        .then(res=>res.json())
        .then(j=>{
          const text = j.extract || 'No hay información disponible';
          const image = j.thumbnail?.source || j.originalimage?.source;
          setWikiInfo(prev=>({...prev,[cat]:{text,image}}));
        })
        .catch(()=>setWikiInfo(prev=>({...prev,[cat]:{text:'No se pudo cargar la información'}})));
    }
  }

  function recordAttempt(speciesId:string, corrects:Record<keyof Taxonomy,boolean>){
    setStats(prev=>{
      const copy = {...prev};
      if(!copy[speciesId]) copy[speciesId] = makeEmptyPerSpeciesStats();
      const entry = {...copy[speciesId]};
      entry.attempts++;
      if(RANKS.every(r=>corrects[r])) entry.correctFull++;
      RANKS.forEach(r=>entry.correctByRank[r] = (entry.correctByRank[r]||0) + (corrects[r]?1:0));
      copy[speciesId] = entry;
      return copy;
    });
  }

  function submit(){
    if(!current) return;
    let points=0;
    const corrects: Record<keyof Taxonomy,boolean> = {} as any;
    RANKS.forEach(rank=>{
      const expected = current.taxonomy[rank].toLowerCase();
      const given = (answers[rank]||'').trim().toLowerCase();
      if(!given){ corrects[rank]=false; return; }
      if(rank==='species'){
        const lastWord = current.taxonomy[rank].split(' ').slice(-1)[0].toLowerCase();
        if(given===expected || given===lastWord){ points++; corrects[rank]=true; return; }
      }
      if(given===expected){ points++; corrects[rank]=true; return; }
      corrects[rank]=false;
    });
    setScore(s=>s+points);
    setLastResult({points,corrects,expected:current.taxonomy});
    recordAttempt(current.id,corrects);
  }

  function nextSpecies(){
    if(!current) return;
    const next = getNextSpecies(SPECIES,stats,current.id);
    setCurrent(next);
    setAnswers({phylum:'',class:'',order:'',family:'',genus:'',species:''});
    setLastResult(null);
  }

  function reset(){
    setScore(0);
    setLastResult(null);
    setAnswers({phylum:'',class:'',order:'',family:'',genus:'',species:''});
    setCurrent(SPECIES[0]||null);
    const empty: AllStats = {};
    SPECIES.forEach(s=>empty[s.id]=makeEmptyPerSpeciesStats());
    setStats(empty);
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  }


  //
  // App style
  //


  // --- styles (added progress bar) ---
  const style = `:root{--bg:#f7fbff;--card:#ffffff;--accent:rgba(58, 105, 99, 0.9);--muted:#6b7280}
  .wrap{max-width:720px;margin:18px auto;padding:12px;font-family:Inter,system-ui,Segoe UI,Helvetica,Arial,sans-serif}
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
  input.input-correct {
    border-color: #34d399; /* verde */
    box-shadow: inset 0 0 0 6px rgba(52,211,153,0.08);
    transition: box-shadow 180ms, border-color 180ms;
  }
  input.input-wrong {
    border-color: #f87171; /* rojo */
    box-shadow: inset 0 0 0 6px rgba(248,113,113,0.08);
    transition: box-shadow 180ms, border-color 180ms;
  }
  button{background:var(--accent);color:white;border:0;padding:10px 14px;border-radius:10px;font-weight:600}
  .ghost{background:transparent;color:var(--accent);border:1px solid rgba(59,130,246,0.12)}
  .small{font-size:13px;color:var(--muted)}
  .top-right{position:absolute;right:18px;top:18px;display:flex;gap:8px}
  .progress-row{display:flex;align-items:center;gap:12px;margin:8px 0}
  .progress-bar{flex:1;height:12px;background:#eef6ff;border-radius:999px;overflow:hidden}
  .progress-fill{height:100%;background:var(--accent)}
  .species-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9}
  .species-left{display:flex;gap:12px;align-items:center}
  .small-muted{font-size:12px;color:#94a3b8}
   /* resaltado suave para inputs tras enviar respuesta */
  /* pequeño progreso para cada especie */
  .progress-mini {
    width: 80px;
    height: 6px;
    border-radius: 4px;
    background: #e2e8f0;
    overflow: hidden;
  }
  .progress-mini-fill {
    height: 100%;
    background: rgba(58, 105, 99, 0.9);
    transition: width 0.25s;
  }

  .card-mini {
    margin-bottom: 12px;
    padding: 12px 14px;
    background: rgb(251, 253, 255);
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cgi-title {
    font-size: 14px;
    color: #334155;
    margin-bottom: 6px;
  }

  .cgi-progress-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cgi-progress-bar {
    flex: 1;
    height: 6px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
  }

  .cgi-progress-bar-fill {
    height: 100%;
    background: rgba(58, 105, 99, 0.9);
    transition: width 0.25s;
  }

  .cgi-progress-text {
    font-size: 13px;
    color: #334155;
    font-weight: 600;
  }


  `;


  //
  // App interface
  //
  return (
    <div className="wrap">
      <style>{style}</style>

      {/* ------------------- HOME SCREEN ------------------- */}
      {screen === 'home' && (
        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
          {/* Logo */}
          <img
            src={`${process.env.PUBLIC_URL}/Logo_TaxoGuessr.png`}
            alt="CladeQuest logo"
            style={{ width: 260, height: 'auto', marginBottom: 10 }}
          />

          {/* Imagen representativa */}
          <div
            style={{
              width: '100%',
              height: 160,
              borderRadius: 12,
              overflow: 'hidden',
              background: '#eef2f8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20
            }}
          >
            <img
              src={`${process.env.PUBLIC_URL}/Home_picture.jpg`}
              alt="Vista previa del juego"
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
            />
          </div>

          {/* Descripción */}
          <p className="small" style={{ marginBottom: 20, lineHeight: 1.6, color: '#475569' }}>
            Descubre la <strong>diversidad de la vida</strong> mientras juegas: aprende a <strong>clasificar especies</strong>,
            desde su <strong>filo</strong> hasta su <strong>especie</strong>, apreciando la <strong>riqueza de la naturaleza</strong>.
            Cada acierto te acerca a <strong>dominar la taxonomía</strong> y reconocer las <strong>conexiones ocultas</strong> entre los seres vivos.
          </p>

          {/* Reglas rápidas */}
          <div style={{ textAlign: 'left', background: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 16 }}>Cómo se juega</h3>
            <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <span>🖼️</span>
                <span>1. Mira la imagen de la especie.</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <span>✏️</span>
                <span>2. Adivina su clasificación taxonómica.</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span>✔️</span>
                <span>3. Recibe feedback inmediato y mejora paso a paso.</span>
              </div>
            </div>
          </div>

          {/* Botón para comenzar partida */}
          <button style={{ width: '100%' }} onClick={() => {
            setCurrent(SPECIES[0]);
            setScreen('game');
          }}>Comenzar partida</button>
        </div>
      )}

      {/* ------------------- PROFILE SCREEN ------------------- */}
      {screen === 'profile' && (
        <div style={{ position: 'relative' }}>
          <div className="top-right">
            <button className="ghost" onClick={() => setScreen('game')}>Volver</button>
          </div>

          <div className="card">
            <h1>Perfil</h1>
            <p className="small">Resumen de progreso</p>

            {/* Estadísticas rápidas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <div style={{ background: '#fbfdff', padding: 12, borderRadius: 10 }}>
                <div className="small">Especies jugadas</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{profileData.playedSpecies}/{profileData.totalSpecies}</div>
              </div>
              <div style={{ background: '#fbfdff', padding: 12, borderRadius: 10 }}>
                <div className="small">Especies acertadas al 100%</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{profileData.speciesCorrectAll}/{profileData.totalSpecies}</div>
              </div>
            </div>

            {/* Precisión por rango */}
            <div style={{ marginTop: 16 }}>
              <div className="small">Precisión por rango</div>
              {RANKS.map(r => (
                <div key={r} className="progress-row">
                  <div style={{ width: 90, textTransform: 'capitalize' }}>{r}</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.round(profileData.rankPct[r])}%` }} />
                  </div>
                  <div style={{ width: 50, textAlign: 'right' }}>{Math.round(profileData.rankPct[r])}%</div>
                </div>
              ))}
            </div>

            {/* Especies fallidas */}
            <div style={{ marginTop: 18 }}>
              <div className="small">Juega a las especies que aún no dominas</div>
              <div style={{ marginTop: 8 }}>
                {(!profileData.failedSpeciesList || profileData.failedSpeciesList.length === 0) ? (
                  <div className="small" style={{ marginTop: 6 }}>¡Perfecto! No hay especies con errores aún.</div>
                ) : (
                  profileData.failedSpeciesList.map(item => (
                    <div className="species-row" key={item.species.id}>
                      <div className="species-left">
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: '#e6eefc' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{item.species.display}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                            <div className="progress-mini">
                              <div className="progress-mini-fill" style={{ width: `${(item.correctCount / RANKS.length) * 100}%` }} />
                            </div>
                            <div className="small-muted" style={{ minWidth: 48 }}>{item.correctCount}/{RANKS.length}</div>
                          </div>
                        </div>
                      </div>
                      <button className="ghost" onClick={()=>{
                        setCurrent(item.species);
                        setScreen('game');
                      }}>Practicar</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------- END OF GAME ------------------- */}
      {!current && screen==='game' && (
        <div className="card">
          <img
            src={`${process.env.PUBLIC_URL}/Logo_TaxoGuessr.png`}
            alt="CladeQuest logo"
            style={{ width: 300, height: 'auto', marginBottom: 12 }}
          />
          <p className="small">
            Enhorabuena! Se han completado las especies. Puntuación final: <strong>{score}</strong>
          </p>
          <div style={{ marginTop: 12 }}>
            <button onClick={reset}>Reiniciar</button>
          </div>
        </div>
      )}

      {/* ------------------- GAME SCREEN ------------------- */}
      {current && screen==='game' && (
        <div className="card">
          <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={`${process.env.PUBLIC_URL}/Logo_TaxoGuessr.png`} alt="logo" style={{ width: 120 }} />
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button className="ghost" onClick={()=>setScreen('home')} aria-label="Home">🏠</button>
              <button className="ghost" onClick={()=>setScreen('profile')} aria-label="Perfil">👤</button>
            </div>
          </header>

          {/* Progreso mini */}
          <div className="card-mini">
            <div className="cgi-progress-row">
              <div className="cgi-title">Especies jugadas:</div>
              <div className="cgi-progress-bar">
                <div className="cgi-progress-bar-fill" style={{ width: `${(profileData.playedSpecies / profileData.totalSpecies) * 100}%` }} />
              </div>
              <span className="cgi-progress-text">{profileData.playedSpecies}/{SPECIES.length}</span>
            </div>
            <div className="cgi-title">Nombre común: <strong>{current.display}</strong></div>
          </div>

          {/* Imagen */}
          <div className="image">
            {loadingImage ? <div className="small">Cargando imagen…</div> :
              imageUrl ? <img src={imageUrl} alt={current.display}/> :
              <div className="small">Sin imagen disponible para <strong>{current.sci}</strong></div>
            }
          </div>

          {/* Inputs por rango */}
          <div style={{ marginTop: 12 }}>
            {RANKS.map(rank=>{
              const cat = current.taxonomy[rank];
              return (
                <div className="row" key={rank}>
                  <div className="col">
                    <label>{rank.charAt(0).toUpperCase()+rank.slice(1)}</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        style={{ flex: 1 }}
                        className={lastResult ? (lastResult.corrects[rank]?'input-correct':'input-wrong') : ''}
                        value={answers[rank]||''}
                        onChange={e=>handleInput(rank,e.target.value)}
                        placeholder={rank}
                        disabled={!!lastResult} 
                        readOnly={!!lastResult}  // fuerza que no se pueda escribir
                      />
                      {!lastResult && (
                        <button className="ghost" onClick={()=>{
                          const q = prompt('Opciones: '+ (optionsByRank[rank]||[]).slice(0,10).join(', '));
                          if(q) handleInput(rank,q);
                        }}>💡</button>
                      )}

                      {lastResult && cat && (
                        <button className="ghost" disabled>?</button> // popup deshabilitado
                      )}
                    </div>

                    {/* Mostrar solución si falló */}
                    {lastResult && !lastResult.corrects[rank] && (
                      <div style={{ display:'inline-block', padding:'4px 8px', borderRadius:6, background:'#d1fae5', fontSize:13, color:'#065f46', marginTop:4 }}>
                        {lastResult.expected[rank]}
                      </div>
                    )}

                    {/* Popup */}
                    {cat && popupVisible[cat] && (
                      <div style={{
                        position:'fixed', top:0,left:0,width:'100vw',height:'100vh',display:'flex',justifyContent:'center',alignItems:'center',
                        backgroundColor:'rgba(0,0,0,0.4)', zIndex:9999, padding:16, boxSizing:'border-box'
                      }}>
                        <div style={{
                          background:'#fff', borderRadius:12, padding:24, maxWidth:400, width:'100%', maxHeight:'90vh', overflowY:'auto', position:'relative',
                          boxShadow:'0 8px 24px rgba(0,0,0,0.2)'
                        }}>
                          <button onClick={()=>setPopupVisible(prev=>({...prev,[cat]:false}))} style={{
                            position:'absolute', top:12, right:12, border:'none', background:'transparent', fontSize:20, cursor:'pointer', color:'#333'
                          }}>×</button>
                          <h3 style={{ marginTop:0 }}>{cat}</h3>
                          <p>{wikiInfo[cat]?.text || 'Cargando información...'}</p>
                          {wikiInfo[cat]?.image && <img src={wikiInfo[cat].image} alt={cat} style={{ width:'100%', marginTop:12, borderRadius:8 }}/>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botones enviar / siguiente */}
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            {!lastResult && <button onClick={submit}>Enviar respuesta</button>}
            <button className="ghost" onClick={nextSpecies} disabled={!lastResult}>Siguiente especie</button>
          </div>

          {lastResult && <div style={{ marginTop:10, fontWeight:700 }}>Resultado: {lastResult.points} puntos en esta ronda.</div>}
        </div>
      )}
    </div>
  );

}