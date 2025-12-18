import React, { useEffect, useMemo, useState } from 'react';
import SPECIES_JSON from './species_100_gbif.json';

const SPECIES = SPECIES_JSON.slice(0, 5);
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
  lastAttemptByRank: Record<keyof Taxonomy, boolean>; // resultado del último intento (true = acierto)
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  info?: string;
  image?: string;            // ruta en public o URL
  unlocked: boolean;
  unlockedAt?: string;
};

type AllStats = Record<string, PerSpeciesStats>; // keyed by species.id

// key para localStorage de Achievements
const STORAGE_KEY = 'clades_stats_v1';
// key para localStorage de logros
const ACH_KEY = 'clades_achievements_v1';

const RANKS: (keyof Taxonomy)[] = ['phylum','class','order','family','genus','species'];

// definición estática de los logros/trofeos
const ACH_DEFS: Omit<Achievement, 'unlocked'|'unlockedAt'>[] = [
  { id: 'first_play', title: 'El novato', description: 'Has jugado tu primera especie', info: '', image: '/achievements/medalla_filosofia.png' },
  { id: '25_species', title: 'Trofeo Linn Margulis', description: 'Has completado el 25% de las especies!', info: 'La gran aportación de Lynn Margulis a la taxonomía y biología evolutiva fue la Teoría de la Endosimbiosis Seriada, explicando que las células eucariotas (con núcleo) surgieron de la fusión simbiótica de bacterias procariotas, dando origen a mitocondrias y cloroplastos, y propuso, junto a Whittaker, la clasificación de los seres vivos en cinco reinos (Moneras, Protoctistas, Hongos, Plantas y Animales) basada en la simbiogénesis, enfatizando la cooperación sobre la competencia en la evolución. ', image: '/achievements/trofeo_lynn.png' },
  { id: '50_species', title: 'Trofeo Aristóteles', description: 'Has completado el 50% de las especies!', info: 'Aristóteles es considerado el padre de la taxonomía por crear el primer sistema jerárquico de clasificación biológica, dividiendo el mundo natural en dos grandes reinos (Animal y Vegetal) y clasificando a los animales según la presencia de sangre (con sangre roja vs. sin sangre) y características como hábitat y forma de reproducción, sentando las bases para la organización científica de los seres vivos mediante la observación empírica. Introdujo por primera vez conceptos como el género y la especie.', image: '/achievements/trofeo_aristoteles.png' },
  { id: '75_species', title: 'Trofeo Darwin', description: 'Has completado el 75% de las especies!', info: '', image: '/achievements/trofeo_darwin.png' },
  { id: '100_species', title: 'Trofeo Linneo', description: 'Has completado el 100% de las species!', info: '', image: '/achievements/trofeo_linneo.png' },

  { id: '80_phylum', title: 'Amante de la filosofía', description: 'Has acertado el 80% de los filos!', info: '', image: '/achievements/medalla_filosofia.png' },
  { id: '80_class', title: 'Amante de lo clásico', description: 'Has acertado el 80% de las clases!', info: '', image: '/achievements/medalla_clasico.png' },
  { id: '80_order', title: 'Amante del orden', description: 'Has acertado el 80% de los ordenes!', info: '', image: '/achievements/medalla_orden.png'},
  { id: '80_family', title: 'Amante del orden', description: 'Has acertado el 80% de las familias!', info: '', image: '/achievements/medalla_familia.png' },
  { id: '80_genus', title: 'Generalista', description: 'Has acertado el 80% de los géneros!', info: '', image: '/achievements/medalla_genero.png' },
  { id: '80_species', title: 'Amante de las especies', description: 'Has acertado el 80% de las especies!', info: '', image: '/achievements/medalla_especie.png' }
];

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
  const lastAttempt = {} as Record<keyof Taxonomy, boolean>;
  RANKS.forEach(r => {
    byRank[r] = 0;
    lastAttempt[r] = false;
  });
  return { attempts: 0, correctFull: 0, correctByRank: byRank, lastAttemptByRank: lastAttempt };
}

// helper: porcentaje de especies completadas (basado en "perfect" o en último intento)
// aquí uso "isSpeciesPerfect" que ya tienes (ajústalo si tu lógica es distinta)
function percentSpeciesCompleted(statsObj: AllStats){
  const total = SPECIES.length;
  const complete = SPECIES.reduce((acc, sp) => {
    const s = statsObj[sp.id];
    if(!s) return acc;
    // consideramos 'perfect' como aquellas con correctByRank todos > 0
    const isPerfect = RANKS.every(r => (s.correctByRank?.[r] || 0) > 0);
    return acc + (isPerfect ? 1 : 0);
  }, 0);
  return (complete / total) * 100;
}

// helper: porcentaje de especies con rango acertado en último intento (o histórico si no hay lastAttempt)
function percentRankCoverage(statsObj: AllStats, rank: keyof Taxonomy){
  const total = SPECIES.length;
  let count = 0;
  SPECIES.forEach(sp => {
    const s = statsObj[sp.id];
    if (!s) return;
    // preferimos lastAttemptByRank si existe, sino fallback a historical (correctByRank>0)
    // esto hace tu lógica robusta si no añadiste lastAttemptByRank
    // @ts-ignore
    const last = s.lastAttemptByRank?.[rank];
    if (typeof last === 'boolean') {
      if (last) count++;
    } else {
      if ((s.correctByRank?.[rank] || 0) > 0) count++;
    }
  });
  return (count / total) * 100;
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
  // Estado para información de Wikipedia (texto + imagen)
  const [wikiInfo, setWikiInfo] = useState<Record<string, { text: string; image?: string }>>({});
  const [popupVisible, setPopupVisible] = useState<Record<string, boolean>>({});

  // Función para abrir/ cerrar popup y fetch de Wikipedia
  function togglePopup(rank: keyof Taxonomy) {
    const correctCategory = current?.taxonomy[rank];
    if (!correctCategory) return;

    const visible = popupVisible[correctCategory];
    setPopupVisible(prev => ({ ...prev, [correctCategory]: !visible }));

    // Fetch info si no está cargada
    if (!wikiInfo[correctCategory] && !visible) {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(correctCategory)}`;
      fetch(url)
        .then(res => res.json())
        .then(data => {
          const text = data.extract || 'No hay información disponible';
          const image = data.thumbnail?.source || data.originalimage?.source;
          setWikiInfo(prev => ({
            ...prev,
            [correctCategory]: { text, image }
          }));
        })
        .catch(() => {
          setWikiInfo(prev => ({
            ...prev,
            [correctCategory]: { text: 'No se pudo cargar la información' }
          }));
        });
    }
  }



  /*
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
  */
  const [stats, setStats] = useState<AllStats>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AllStats;

        const normalized: AllStats = {};
        SPECIES.forEach(sp => {
          const stored = parsed[sp.id];
          const empty = makeEmptyPerSpeciesStats();

          normalized[sp.id] = stored
            ? {
                attempts: stored.attempts ?? empty.attempts,
                correctFull: stored.correctFull ?? empty.correctFull,
                correctByRank: { ...empty.correctByRank, ...(stored.correctByRank || {}) },
                lastAttemptByRank: { ...empty.lastAttemptByRank, ...(stored.lastAttemptByRank || {}) }
              }
            : empty;
        });

        return normalized;
      }
    } catch (e) {}

    const base: AllStats = {};
    SPECIES.forEach(s => base[s.id] = makeEmptyPerSpeciesStats());
    return base;
  });

  // estado local para logros
  const [achievements, setAchievements] = useState<Record<string, Achievement>>(() => {
    try {
      const raw = localStorage.getItem(ACH_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e){}
    // inicializar con definitions (locked)
    const obj: Record<string, Achievement> = {};
    ACH_DEFS.forEach(a => obj[a.id] = { ...a, unlocked: false });
    return obj;
  });

  // popup de logro (cuando se consigue)
  const [achievementPopup, setAchievementPopup] = useState<Achievement | null>(null);


  function saveAchievementsToStorage(obj: Record<string, Achievement>){
    try{ localStorage.setItem(ACH_KEY, JSON.stringify(obj)); }catch(e){}
  }

  function awardAchievement(id: string, statsSnapshot: AllStats){
    setAchievements(prev => {
      if(prev[id]?.unlocked) return prev; // ya conseguido
      const now = new Date().toISOString();
      const copy = { ...prev, [id]: { ...prev[id], unlocked: true, unlockedAt: now } };
      saveAchievementsToStorage(copy);
      // mostrar popup con la info del logro
      setAchievementPopup(copy[id]);
      return copy;
    });
  }

  // función que revisa todas las condiciones, la llamaremos después de actualizar stats
  function checkAchievements(statsSnapshot: AllStats){
    // nº especies completadas %
    const pctSpecies = percentSpeciesCompleted(statsSnapshot);

    if(pctSpecies >= 25) awardAchievement('25_species', statsSnapshot);
    if(pctSpecies >= 50) awardAchievement('50_species', statsSnapshot);
    if(pctSpecies >= 75) awardAchievement('75_species', statsSnapshot);
    if(pctSpecies >= 100) awardAchievement('100_species', statsSnapshot);

    // first play: alguna especie jugada
    const playedCount = Object.values(statsSnapshot).filter(s => s.attempts > 0).length;
    if(playedCount >= 1) awardAchievement('first_play', statsSnapshot);

    // rank coverage trophies (80%)
    if(percentRankCoverage(statsSnapshot, 'phylum') >= 80) awardAchievement('80_phylum', statsSnapshot);
    if(percentRankCoverage(statsSnapshot, 'class') >= 80) awardAchievement('80_class', statsSnapshot);
    if(percentRankCoverage(statsSnapshot, 'order') >= 80) awardAchievement('80_order', statsSnapshot);
    if(percentRankCoverage(statsSnapshot, 'family') >= 80) awardAchievement('80_family', statsSnapshot);
    if(percentRankCoverage(statsSnapshot, 'genus') >= 80) awardAchievement('80_genus', statsSnapshot);
    if(percentRankCoverage(statsSnapshot, 'species') >= 80) awardAchievement('80_species', statsSnapshot);

  }

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

  function handleInput(rank: keyof Taxonomy, value: string) {
    setAnswers(prev => {
      if (rank === 'genus') {
        // Si species todavía contiene solo lo que se copió del género, autocompletamos species
        return {
          ...prev,
          genus: value,
          species: prev.species === prev.genus ? value : prev.species
        };
      } else if (rank === 'species') {
        // Tomamos la primera palabra de species
        const firstWord = value.split(' ')[0];
        // Si genus todavía contiene solo lo que se copió de species, autocompletamos genus
        return {
          ...prev,
          species: value,
          genus: prev.genus === prev.species ? firstWord : prev.genus
        };
      } else {
        // Para otros campos, solo actualizamos el campo correspondiente
        return { ...prev, [rank]: value };
      }
    });
  }

    
  

  // update stats helper after an attempt
  function recordAttemptInStats(speciesId: string, corrects: Record<keyof Taxonomy, boolean>){
    setStats(prev => {
        const copy = { ...prev };
        if(!copy[speciesId]) copy[speciesId] = makeEmptyPerSpeciesStats();
        const entry = { ...copy[speciesId] };

        entry.attempts = (entry.attempts || 0) + 1;

        // si todo correcto -> full correct
        const allTrue = RANKS.every(r => !!corrects[r]);
        if(allTrue) entry.correctFull = (entry.correctFull||0) + 1;

        // Nuevo: registrar solo si el rango se acertó en este intento
        const byRank: Record<keyof Taxonomy, number> = {} as any;
        RANKS.forEach(r => { byRank[r] = corrects[r] ? 1 : 0; });
        entry.correctByRank = byRank;

        // guardar resultado del último intento por rango (true = acierto, false = fallo)
        const lastAttempt: Record<keyof Taxonomy, boolean> = { ...entry.lastAttemptByRank };
        RANKS.forEach(r => { lastAttempt[r] = !!corrects[r]; });
        entry.lastAttemptByRank = lastAttempt;

        copy[speciesId] = entry;

        // Chequeamos logros usando el copy NUEVO
        // Nota: dentro de setState updater aún tenemos el `copy` actualizado
        // pero no podemos llamar checkAchievements fuera (setStats returns), así que
        // programamos una micro-tarea para ejecutarlo justo después del setState,
        // pasando el snapshot 'copy' (que es seguro).
        setTimeout(() => checkAchievements(copy), 0);

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

  function isSpeciesPerfect(speciesId: string): boolean {
    const s = stats[speciesId];
    if (!s) return false;
    // cada rango debe haberse acertado al menos una vez
    return RANKS.every(rank => s.correctByRank[rank] > 0);
  }

  function getSuggestionsSimple(rank: keyof Taxonomy){
    const pool = (optionsByRank[rank]||[]).filter(x=>x!==current?.taxonomy?.[rank]);
    const shuffle = (a:string[])=>a.slice().sort(()=>Math.random()-0.5);
    const picks = shuffle(pool).slice(0,9);
    const correct = current?.taxonomy?.[rank];
    if(correct) picks.splice(Math.floor(Math.random()*(picks.length+1)),0,correct);
    return picks;
  }


  function nextSpecies() {
    if (!current) return;

    // filtramos las especies que aún no están perfectas
    const incomplete = SPECIES.filter(s => !isSpeciesPerfect(s.id));

    if (incomplete.length === 0) {
      // todas las especies completadas
      setCurrent(null);
      setAnswers({ phylum:'', class:'', order:'', family:'', genus:'', species:'' });
      setLastResult(null);
      return;
    }

    // elegimos aleatoriamente una especie incompleta
    const pick = incomplete[Math.floor(Math.random() * incomplete.length)];
    setCurrent(pick);
    setAnswers({ phylum:'', class:'', order:'', family:'', genus:'', species:'' });
    setLastResult(null);
    
    // actualizamos remaining para no volver a seleccionar la misma especie inmediatamente
    setRemaining(incomplete.filter(s => s.id !== pick.id));
  }

  // función para reiniciar estadísticas y volver a jugar
  function restartWithStatsReset() {
    const fresh = shuffle(SPECIES.slice());
    setRemaining(fresh);
    setCurrent(fresh[0] || null);
    setAnswers({phylum:'',class:'',order:'',family:'',genus:'',species:''});
    setScore(0);
    setLastResult(null);

    // reiniciar stats
    const empty: AllStats = {};
    SPECIES.forEach(s => empty[s.id] = makeEmptyPerSpeciesStats());
    setStats(empty);
    try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
  }

  // función para volver a jugar sin reiniciar estadísticas
  function restartWithoutStatsReset() {
  const fresh = shuffle(SPECIES.slice()); // nueva partida
    setRemaining(fresh);
    setCurrent(fresh[0] || null);
    setAnswers({ phylum:'', class:'', order:'', family:'', genus:'', species:'' });
    setLastResult(null);
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
    
    // Nuevo: contar cuántas especies tienen cada rango acertado EN EL ÚLTIMO INTENTO
    const rankCorrectCounts: Record<keyof Taxonomy, number> = {} as any;
    RANKS.forEach(r => rankCorrectCounts[r] = 0);

    SPECIES.forEach(sp => {
      const s = stats[sp.id] || makeEmptyPerSpeciesStats();
      RANKS.forEach(r => {
        if (s.lastAttemptByRank && s.lastAttemptByRank[r]) rankCorrectCounts[r] += 1;
      });
    });

    // Convertimos a porcentaje sobre el total de especies en el dataset
    const rankPct: Record<keyof Taxonomy, number> = {} as any;
    RANKS.forEach(r => {
      rankPct[r] = SPECIES.length > 0 ? (rankCorrectCounts[r] / SPECIES.length) * 100 : 0;
    });
    /*
    Antigua forma de calcular los porcentajes basado en total de intentos
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
    */

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

    //--- Lista de especies jugadas ---

    // Lista de especies jugadas
    const playedSpeciesList = SPECIES.map(sp => {
      const s = stats[sp.id] || makeEmptyPerSpeciesStats();
      const attempts = s.attempts || 0;
      const correctCount = RANKS.reduce((acc, r) => acc + ((s.correctByRank[r] || 0) > 0 ? 1 : 0), 0);
      return { species: sp, attempts, correctCount };
    }).filter(item => item.attempts > 0)
      .sort((a, b) => a.correctCount - b.correctCount);

    /*// --- NUEVO: construir la lista de especies jugadas con fallos ---
    // Para cada especie tomamos su entry en stats y contamos cuántas categorías
    // han sido acertadas al menos una vez (correctByRank[r] > 0).
    // Solo incluimos especies con attempts > 0 y correctCount < 6 (es decir, falló al menos alguna categoría).
    const failedSpeciesList = SPECIES.map(sp => {
      const s = stats[sp.id] || makeEmptyPerSpeciesStats();
      const attempts = s.attempts || 0;

      // correctCount: número de rangos (de 6) que se han acertado al menos una vez históricamente
      const correctCount = RANKS.reduce((acc, r) => acc + ((s.correctByRank[r] || 0) > 0 ? 1 : 0), 0);

      const hasAnyMistake = attempts > 0 && correctCount < RANKS.length;

      return {
        species: sp,
        attempts,
        correctCount,
        hasAnyMistake
      };
    })
    // solo las que tengan al menos un intento y algún fallo
    .filter(item => item.hasAnyMistake)
    // ordenar peor → mejor (menos aciertos primero)
    .sort((a, b) => a.correctCount - b.correctCount);*/

    return { playedSpecies, totalSpecies: SPECIES.length, speciesCorrectAll, rankPct, speciesList, playedSpeciesList, /*failedSpeciesList*/ };
  },[stats]);




  //
  // App style
  //

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

.achievements-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* EXACTAMENTE 3 por fila */
  gap: 16px;
  margin-top: 12px;
}

.achievement {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* Overlay con efecto blur */
.achievement-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;

  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);

  /* Ligero tinte para mejorar contraste */
  background-color: rgba(255, 255, 255, 0.08);
}

/* Caja del popup */
.achievement-modal {
  background: #ffffff;
  padding: 20px;
  border-radius: 12px;
  max-width: 420px;
  width: 90%;
  text-align: center;

  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

/* Imagen del logro */
.achievement-image {
  width: 120px;
  height: 120px;
  object-fit: contain;
}

/* Texto */
.achievement-description {
  color: black;
  font-size: 16px;
  font-weight: 700;
}

.achievement-info {
  color: #374151;
}

/* Botonera */
.achievement-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
}

/* Animación opcional de entrada */
.achievement-overlay {
  animation: achievementFadeIn 0.3s ease-out;
}

.achievement-modal {
  animation: achievementModalIn 0.25s ease-out;
}

@keyframes achievementFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}




  `;


  //
  // App interface
  //
  if (screen === 'home') {
    return (
      <div className="wrap">
        <style>{style}</style>

        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
          
          {/* Logo */}
          <img
            src={`${process.env.PUBLIC_URL}/Logo_TaxoGuessr_2.png`}
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
          <p className="small" style={{ marginBottom: '20px', lineHeight: '1.6', color:'#475569' }}>
            Descubre la <strong>diversidad de la vida</strong> mientras juegas: aprende a <strong>clasificar especies</strong>, 
            desde su <strong>filo</strong> hasta su <strong>especie</strong>
            , apreciando la <strong>riqueza de la naturaleza</strong>.
          </p>

          {/* Reglas rápidas */}
          <div 
            style={{
              textAlign: 'left',
              background: '#f8fafc',
              padding: '15px',
              borderRadius: 12,
              marginBottom: 20
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', fontSize: 16 }}>Cómo se juega</h3>

            <div style={{ fontSize: 14, color: '#475569', lineHeight: '1.5' }}>
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

          {/* Botones */}
          <button 
            style={{ width: '100%', marginBottom: '10px' }}
            onClick={() => setScreen('game')}
          >
            Comenzar partida
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

          <div className="card">

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: 10 
            }}>
              <img
                src={`${process.env.PUBLIC_URL}/Logo_TaxoGuessr_2.png`}
                alt="CladeQuest logo"
                style={{ width: 120, height: 'auto' }}
              />

              {/* He quitado el div "top-right" intermedio para que el flex funcione directo sobre el botón */}
              <button className="ghost" onClick={()=>setScreen('game')}>
                Volver
              </button>
            </div>

            <h1>Perfil</h1>
            <p className="small">Resumen de progreso</p>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:8}}>
              <div style={{background:'#fbfdff',padding:12,borderRadius:10}}>
                <div className="small">Especies jugadas</div>
                <div style={{fontWeight:700,fontSize:18}}>{profileData.playedSpecies}/{profileData.totalSpecies}</div>
              </div>
              <div style={{background:'#fbfdff',padding:12,borderRadius:10}}>
                <div className="small">Especies acertadas al 100%</div>
                <div style={{fontWeight:700,fontSize:18}}>{profileData.speciesCorrectAll}/{profileData.totalSpecies}</div>
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

            {/* Achievements / trophies */}
            <div style={{ marginTop: 18 }}>
              <h3 style={{ margin: '8px 0' }}>Trofeos y logros</h3>
              <div className="achievements-list">
                {Object.values(achievements).map(a => (
                  <div className="achievement" key={a.id} style={{
                    width: 140, padding: 10, borderRadius: 10, background: a.unlocked ? 'rgba(58, 105, 99, 0.2)' : '#fbfbfb',
                    border: a.unlocked ? '1px solid rgba(58, 105, 99, 0.9)' : '1px solid #eef2f6', display:'flex', flexDirection:'column', alignItems:'center'
                  }}>
                    <img src={`${process.env.PUBLIC_URL}${a.image}`} alt={a.title} style={{ width: 70, height: 70, objectFit: 'contain', opacity: a.unlocked ? 1 : 0.3 }} />
                    <div style={{ fontWeight: 500, marginTop: 8, fontSize: 13 }}>{a.title}</div>
                  </div>
                ))}
              </div>
            </div>


            <div style={{marginTop:18}}>
              <div className="small">Juega a las especies que aún no dominas</div>
              <div style={{marginTop:8}}>
                {(!profileData || !profileData.playedSpeciesList || profileData.playedSpeciesList.length === 0) ? (
                  <div className="small" style={{marginTop:6}}>¡Perfecto! No hay especies con errores aún.</div>
                ) : (
                  profileData.playedSpeciesList.map(item => (
                    <div className="species-row" key={item.species.id}>
                      <div className="species-left" style={{display:'flex',gap:12,alignItems:'center'}}>
                        <div style={{width:10,height:10,borderRadius:3,background:'#e6eefc'}} />
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700}}>{item.species.display}</div>

                          {/* Barra de progreso + texto debajo */}
                          <div style={{display:'flex', alignItems:'center', gap:10, marginTop:6}}>
                            <div className="progress-mini">
                              <div
                                className="progress-mini-fill"
                                style={{ width: `${(item.correctCount / RANKS.length) * 100}%` }}
                              />
                            </div>
                            <div className="small-muted" style={{minWidth:48}}>
                              {item.correctCount}/{RANKS.length}
                            </div>
                          </div>

                        </div>
                      </div>

                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <button className="ghost" onClick={()=>{
        
                          // limpiar inputs y feedback para que la pantalla de juego se reinicie
                          setAnswers({ phylum:'', class:'', order:'', family:'', genus:'', species:'' });
                          setLastResult(null);
                          setScreen('game');
                          // practice this species: set as current and remove from remaining
                          setCurrent(item.species);
                          console.log(achievements);

                        }}> Practicar </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>


          </div>
        </div>
      </div>
    );
  }



  if (!current) {
    return (
      <div className="wrap">
        <style>{style}</style>
        <div className="card" style={{textAlign:'center'}}>
          <img
            src={`${process.env.PUBLIC_URL}/Logo_TaxoGuessr_2.png`}
            alt="CladeQuest logo"
            style={{ width: 300, height: 'auto', marginBottom: 12 }}
          />
          <p className="small" style={{marginBottom:16}}>
            ¡Enhorabuena! Has perfeccionado todas las especies.
          </p>
          <div style={{display:'flex', gap:12, justifyContent:'center'}}>
            <button onClick={restartWithStatsReset}>
              Volver a jugar y reiniciar estadísticas
            </button>
            <button onClick={restartWithoutStatsReset}>
              Volver a jugar sin reiniciar estadísticas
            </button>
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
              src={`${process.env.PUBLIC_URL}/Logo_TaxoGuessr_2.png`}
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

        <div className="current_game_info card-mini">

          <div className="cgi-progress-row">
            <div className="cgi-title">Especies jugadas: </div>
            <div className="cgi-progress-bar">
              <div className="cgi-progress-bar-fill" style={{ width: `${(profileData.playedSpecies / profileData.totalSpecies) * 100}%` }}>
                 
              </div>
            </div>
            <span className="cgi-progress-text">
              {profileData.speciesList.filter(s => s.attempts > 0).length}/{SPECIES.length}
            </span>
          </div>

          <div className="cgi-title">Nombre común: <strong>{current.display}</strong></div>

        </div>


        <div className="image">
          {loadingImage ? <div className="small">Cargando imagen…</div> : (
            imageUrl ? <img src={imageUrl} alt={current.display} /> : <div className="small">Sin imagen disponible desde Wikipedia para <strong>{current.sci}</strong></div>
          )}
        </div>

        <div style={{marginTop:12}}>
          {RANKS.map(rank => {
            const currentCategory = current?.taxonomy[rank];

            return (
              <div className="row" key={rank}>
                <div className="col">
                  <>
                    <label>{rank.charAt(0).toUpperCase() + rank.slice(1)}</label>

                    {/* Input + botones */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        style={{ flex: 1 }}
                        className={
                          lastResult && lastResult.corrects[rank]
                            ? 'input-correct'
                            : lastResult
                            ? 'input-wrong'
                            : ''
                        }
                        value={answers[rank] || ''}
                        onChange={e => handleInput(rank, e.target.value)}
                        placeholder={rank}
                      />

                      {!lastResult && (
                        <button
                          className="ghost"
                          style={{
                            padding: '0 12px',
                            fontWeight: 'bold',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onClick={e=>{e.preventDefault(); const list=getSuggestionsSimple(rank); const q=prompt('Opciones: '+list.join(', ')); if(q) handleInput(rank,q);}}
                        >
                          💡
                        </button>
                      )}

                      {lastResult && currentCategory && (
                        <button
                          className="ghost"
                          style={{
                            padding: '0 12px',
                            fontWeight: 'bold',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onClick={() => togglePopup(rank)}
                        >
                          ?
                        </button>
                      )}
                    </div>

                    {/* Mostrar solución */}
                    {lastResult && !lastResult.corrects[rank] && (
                      <div
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: '#d1fae5',
                          fontSize: '13px',
                          color: '#065f46',
                          marginTop: 4
                        }}
                      >
                        {lastResult.expected[rank]}
                      </div>
                    )}

                    {/* Popup */}
                    {currentCategory && popupVisible[currentCategory] && (
                      <div
                          style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          width: '100vw',
                          height: '100vh',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: 'rgba(0,0,0,0.4)',
                          zIndex: 9999,
                          padding: 16, // importante para que no toque los bordes
                          boxSizing: 'border-box'
                        }}
                      >
                        <div
                          style={{
                            background: '#fff',
                            borderRadius: 12,
                            padding: 24,
                            maxWidth: 400,
                            width: '100%',
                            maxHeight: '90vh',       // aquí limitamos la altura del popup
                            overflowY: 'auto',       // scroll si el contenido supera la altura
                            position: 'relative',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                          }}
                        >
                          {/* Botón cerrar */}
                          <button
                            onClick={() =>
                              setPopupVisible(prev => ({ ...prev, [currentCategory]: false }))
                            }
                            style={{
                              position: 'absolute',
                              top: 12,
                              right: 12,
                              border: 'none',
                              background: 'transparent',
                              fontSize: 20,
                              cursor: 'pointer',
                              color: '#333'
                            }}
                          >
                            ×
                          </button>

                          <h3 style={{ marginTop: 0 }}>{currentCategory}</h3>
                          <p>{wikiInfo[currentCategory]?.text || 'Cargando información...'}</p>
                          {wikiInfo[currentCategory]?.image && (
                            <img
                              src={wikiInfo[currentCategory].image}
                              alt={currentCategory}
                              style={{ width: '100%', marginTop: 12, borderRadius: 8 }}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Achievement popup */}
                    {achievementPopup && (
                      <div className="achievement-overlay">
                        <div className="achievement-modal">
                          <h3>{achievementPopup.title}</h3>

                          {achievementPopup.image && (
                            <img
                              src={`${process.env.PUBLIC_URL}${achievementPopup.image}`}
                              alt={achievementPopup.title}
                              className="achievement-image"
                            />
                          )}

                          <p className="achievement-description">
                            {achievementPopup.description}
                          </p>

                          <p className="achievement-info">
                            {achievementPopup.info}
                          </p>

                          <div className="achievement-actions">
                            <button
                              onClick={() => setAchievementPopup(null)}
                              className="ghost"
                            >
                              Cerrar
                            </button>

                            <button
                              onClick={() => {
                                setAchievementPopup(null);
                                setScreen('profile');
                              }}
                              style={{ background: '#3a6963', color: '#fff' }}
                            >
                              Ver perfil
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  </>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{display:'flex',gap:8,marginTop:12}}>
          {!lastResult && (
            <button onClick={submit}>Enviar respuesta</button>
          )}

          {/* Botón para avanzar manualmente; solo activo después de enviar respuesta */}
          <button 
            className="ghost" 
            onClick={nextSpecies}
            disabled={!lastResult}
          >
            Siguiente especie
          </button>

          <button className="ghost" onClick={showSolution}>Solucion</button>
        </div>

        {lastResult && (
          <div style={{marginTop:10,fontWeight:700}}>
            Resultado: {lastResult.points} puntos en esta ronda.
          </div>
        )}

      </div>
    </div>
  );
}
