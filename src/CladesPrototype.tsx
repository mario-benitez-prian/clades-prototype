import React, { useEffect, useMemo, useState } from 'react';



//
// Variables declaration and typescritps
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

// --- stats types for localStorage ---
type PerSpeciesStats = {
  attempts: number;
  correctFull: number; // number of times all ranks correct
  correctByRank: Record<keyof Taxonomy, number>; // counts of corrects by rank
};

type AllStats = Record<string, PerSpeciesStats>; // keyed by species.id

const STORAGE_KEY = 'clades_stats_v1';

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
// App logic
//


function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// helpers to initialize per-species stats
function makeEmptyPerSpeciesStats(): PerSpeciesStats {
  const byRank = {} as Record<keyof Taxonomy, number>;
  RANKS.forEach(r => byRank[r] = 0);
  return { attempts: 0, correctFull: 0, correctByRank: byRank };
}

export default function CladesPrototype(){
  const [screen, setScreen] = useState<'home' | 'game' | 'profile'>('home');
  const [remaining, setRemaining] = useState<Species[]>(() => shuffle(SPECIES.slice()));
  const [current, setCurrent] = useState<Species | null>(() => remaining[0] || null);
  const [answers, setAnswers] = useState<Taxonomy>({phylum:'',class:'',order:'',family:'',genus:'',species:''});
  const [score, setScore] = useState<number>(0);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string|null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  // statistics stored in localStorage
  const [stats, setStats] = useState<AllStats>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        return JSON.parse(raw) as AllStats;
      }
    } catch(e){}
    // initialize empty stats for all species
    const base: AllStats = {};
    SPECIES.forEach(s => base[s.id] = makeEmptyPerSpeciesStats());
    return base;
  });

  // compute options
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

  // persist stats whenever changed
  useEffect(()=>{
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch(e){}
  },[stats]);

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

  // update stats helper after an attempt
  function recordAttemptInStats(speciesId: string, corrects: Record<keyof Taxonomy, boolean>){
    setStats(prev => {
      const copy = { ...prev };
      if(!copy[speciesId]) copy[speciesId] = makeEmptyPerSpeciesStats();
      const entry = { ...copy[speciesId] };
      entry.attempts = (entry.attempts || 0) + 1;
      // if all ranks true -> full correct
      const allTrue = RANKS.every(r => !!corrects[r]);
      if(allTrue) entry.correctFull = (entry.correctFull||0) + 1;
      // increment per-rank counts
      const byRank = { ...entry.correctByRank };
      RANKS.forEach(r => { byRank[r] = (byRank[r]||0) + (corrects[r] ? 1 : 0); });
      entry.correctByRank = byRank;
      copy[speciesId] = entry;
      return copy;
    });
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

    // actualizar score y resultado, pero NO avanzar a la siguiente especie
    setScore(s => s + points);
    setLastResult({points, corrects, expected: current.taxonomy});

    // registrar intento en estadísticas
    recordAttemptInStats(current.id, corrects);

    // dejamos remaining y current tal cual: el usuario decidirá "Siguiente"
  }

  function showSolution(){ if(current) setAnswers(current.taxonomy); }

  function nextSpecies(){
    if(!current) return;
    setRemaining(prev=>{
      const next = prev.filter(p => p.id !== current.id);
      if(next.length === 0){
        // se acabaron las especies
        setCurrent(null);
        setAnswers({phylum:'',class:'',order:'',family:'',genus:'',species:''});
        setLastResult(null);
        return [];
      }
      const pick = next[Math.floor(Math.random()*next.length)];
      setCurrent(pick);
      setAnswers({phylum:'',class:'',order:'',family:'',genus:'',species:''});
      setLastResult(null);
      return next;
    });
  }

  function reset(){
    const fresh = shuffle(SPECIES.slice());
    setRemaining(fresh);
    setCurrent(fresh[0] || null);
    setAnswers({phylum:'',class:'',order:'',family:'',genus:'',species:''});
    setScore(0);
    setLastResult(null);
    // reset stats too
    const empty: AllStats = {};
    SPECIES.forEach(s => empty[s.id] = makeEmptyPerSpeciesStats());
    setStats(empty);
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  }

    // --- derived data for profile view ---
  const profileData = useMemo(()=>{
    const playedSpecies = Object.values(stats).filter(s => s.attempts > 0).length;
    const speciesCorrectAll = Object.values(stats).filter(s => s.attempts > 0 && s.correctFull > 0).length;
    // per-rank accuracy: sum corrects / sum attempts
    let rankTotals: Record<keyof Taxonomy, { correct:number; attempts:number }> = {} as any;
    RANKS.forEach(r => rankTotals[r] = { correct:0, attempts:0 });
    Object.values(stats).forEach(s => {
      if(s.attempts > 0){
        RANKS.forEach(r => {
          rankTotals[r].correct += (s.correctByRank[r] || 0);
          rankTotals[r].attempts += s.attempts;
        });
      }
    });
    const rankPct: Record<keyof Taxonomy, number> = {} as any;
    RANKS.forEach(r => {
      const totals = rankTotals[r];
      rankPct[r] = totals.attempts > 0 ? (totals.correct / totals.attempts) * 100 : 0;
    });

    // species list sorted by performance (worst first). Use full-correct ratio (lower = worse)
    const speciesList = SPECIES.map(sp => {
      const s = stats[sp.id] || makeEmptyPerSpeciesStats();
      const attempts = s.attempts || 0;
      const perfect = s.correctFull || 0;
      const fullRatio = attempts > 0 ? perfect / attempts : NaN;
      return { species: sp, attempts, perfect, fullRatio };
    }).sort((a,b) => {
      const aa = isNaN(a.fullRatio) ? -1 : a.fullRatio;
      const bb = isNaN(b.fullRatio) ? -1 : b.fullRatio;
      // push never-played to end (they have NaN -> -1)
      if(aa === bb) return a.species.display.localeCompare(b.species.display);
      if(aa === -1) return 1;
      if(bb === -1) return -1;
      return aa - bb;
    });

    return { playedSpecies, totalSpecies: SPECIES.length, speciesCorrectAll, rankPct, speciesList };
  },[stats]);



  //
  // App style
  //


  // --- styles (added progress bar) ---
  const style = `:root{--bg:#f7fbff;--card:#ffffff;--accent:#3b82f6;--muted:#6b7280}
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
    box-shadow: 0 0 0 6px rgba(52,211,153,0.08);
    transition: box-shadow 180ms, border-color 180ms;
  }
  input.input-wrong {
    border-color: #f87171; /* rojo */
    box-shadow: 0 0 0 6px rgba(248,113,113,0.08);
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
  `;


  //
  // App interface
  //

  if (screen === 'home') {
    return (
      <div className="wrap">
        <style>{style}</style>
        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
          
          <img
            src={`${process.env.PUBLIC_URL}/Logo_TaxoGuessr.png`}
            alt="CladeQuest logo"
            style={{ width: 300, height: 'auto'}}
          />

          <p className="small" style={{ marginBottom: '20px' }}>
            Aprende taxonomía jugando: identifica el filo, clase, orden y más.
          </p>

          <button 
            style={{ width: '100%', marginBottom: '10px' }}
            onClick={() => setScreen('game')}
          >
            Comenzar partida
          </button>

          <button 
            className="ghost"
            style={{ width: '100%' }}
            onClick={() => setScreen('profile')}
          >
            Ver perfil
          </button>
        </div>
      </div>
    );
  }

  
  // --- profile view ---
  if(screen === 'profile'){
    return (
      <div className="wrap">
        <style>{style}</style>
        <div style={{position:'relative'}}>
          <div className="top-right">
            <button className="ghost" onClick={()=>setScreen('game')}>Volver</button>
          </div>

          <div className="card">
            <h1>Perfil</h1>
            <p className="small">Resumen de progreso</p>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:8}}>
              <div style={{background:'#fbfdff',padding:12,borderRadius:10}}>
                <div className="small">Especies jugadas</div>
                <div style={{fontWeight:700,fontSize:18}}>{profileData.playedSpecies}/{profileData.totalSpecies}</div>
              </div>
              <div style={{background:'#fbfdff',padding:12,borderRadius:10}}>
                <div className="small">Especies acertadas al 100%</div>
                <div style={{fontWeight:700,fontSize:18}}>{profileData.speciesCorrectAll}/{profileData.playedSpecies || profileData.totalSpecies}</div>
              </div>
            </div>

            <div style={{marginTop:16}}>
              <div className="small">Precisión por rango</div>
              {RANKS.map(r => (
                <div key={r} className="progress-row">
                  <div style={{width:90,textTransform:'capitalize'}}>{r}</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width: `${Math.round(profileData.rankPct[r])}%`}} />
                  </div>
                  <div style={{width:50,textAlign:'right'}}>{Math.round(profileData.rankPct[r])}%</div>
                </div>
              ))}
            </div>

            <div style={{marginTop:18}}>
              <div className="small">Especies (peor → mejor)</div>
              <div style={{marginTop:8}}>
                {profileData.speciesList.map(item => (
                  <div className="species-row" key={item.species.id}>
                    <div className="species-left">
                      <div style={{width:10,height:10,borderRadius:3,background:'#e6eefc'}} />
                      <div>
                        <div style={{fontWeight:700}}>{item.species.display}</div>
                        <div className="small-muted">{item.attempts>0 ? `${item.perfect}/${item.attempts} perfect` : 'Sin jugar'}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <button className="ghost" onClick={()=>{
                        // practice this species: set as current and remove from remaining
                        setCurrent(item.species);
                        setRemaining(prev => prev.filter(p=>p.id !== item.species.id));
                        setScreen('game');
                      }}> Practicar </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }



  if(!current){
    return (
      <div className="wrap">
        <style>{style}</style>
        <div className="card">
          <img
            src={`${process.env.PUBLIC_URL}/Logo_TaxoGuessr.png`}
            alt="CladeQuest logo"
            style={{ width: 300, height: 'auto', marginBottom: 12 }}
          />
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
        <header style={{alignItems: 'center', gap: 12 }}>
          {/* Bloque izquierdo */}
          <div style={{ flex: 1 }}>
            <img
              src={`${process.env.PUBLIC_URL}/Logo_TaxoGuessr.png`}
              alt="CladeQuest logo"
              style={{ width: 120, height: 'auto' }}
            />
          </div>

          {/* Iconos alineados al nivel del logo */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="ghost"
              onClick={() => setScreen('home')}
              aria-label="Home"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <button
              className="ghost"
              onClick={() => setScreen('profile')}
              aria-label="Perfil"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </header>

        <div className="current_game_info"  style={{marginBottom: 12}} >
          <div className="meta">Nombre común especie: <strong>{current.display}</strong></div>
          <div className="small">Score: <strong>{score}</strong></div>
          <div className="small">Especies restantes: {remaining.length}</div>
        </div>

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
                
                {/* INICIO DE LOS CAMBIOS: Contenedor Flex */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  
                  <input
                    style={{ flex: 1 }}
                    // preservamos otras clases si las tuvieras (por ejemplo '' o 'mi-clase')
                    className={ lastResult && lastResult.corrects[rank] ? "input-correct" : lastResult ? "input-wrong" : "" }                    value={answers[rank] || ''}
                    onChange={(e) => handleInput(rank, e.target.value)}
                    placeholder={rank}
                  />
                  
                  <button 
                    className="ghost" 
                    style={{ 
                      padding: '0 12px', 
                      fontWeight: 'bold',
                      height: '40px',          // ← igual que el input
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onClick={(e)=>{
                      e.preventDefault();
                      const q = prompt('Sugerencias para '+rank+' (escribe para filtrar)\n\nOpciones: '+(optionsByRank[rank]||[]).slice(0,10).join(', '));
                      if(q) handleInput(rank,q);
                    }}
                  >
                    ?
                  </button>

                </div>
                {/* FIN DE LOS CAMBIOS */}

              </div>
            </div>
          ))}
        </div>

        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button onClick={submit} disabled={!!lastResult}>Enviar respuesta</button>

          <button className="ghost" onClick={showSolution}>Mostrar solución</button>

          {/* Botón para avanzar manualmente; solo activo después de enviar respuesta */}
          <button 
            className="ghost" 
            onClick={nextSpecies}
            disabled={!lastResult}
          >
            Siguiente especie
          </button>
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
