#!/usr/bin/env python3
import requests, time, json, re

# === CONFIGURACIÓN ===
OUTPUT_FILE = "species_100_gbif.json"
DELAY = 0.25  # segundos entre peticiones
GBIF_MATCH = "https://api.gbif.org/v1/species/match?name="
GBIF_SPECIES = "https://api.gbif.org/v1/species/"

# Lista semilla (100 especies) definida más abajo
SEED = [
    ("Homo sapiens", "Humano"),
    ("Pan troglodytes", "Chimpancé"),
    ("Gorilla gorilla", "Gorila occidental"),
    ("Panthera leo", "León"),
    ("Panthera tigris", "Tigre"),
    ("Panthera pardus", "Leopardo"),
    ("Panthera onca", "Jaguar"),
    ("Acinonyx jubatus", "Guepardo"),
    ("Ailuropoda melanoleuca", "Panda gigante"),
    ("Ursus arctos", "Oso pardo"),
    ("Ursus maritimus", "Oso polar"),
    ("Canis lupus", "Lobo"),
    ("Vulpes vulpes", "Zorro rojo"),
    ("Felis catus", "Gato doméstico"),
    ("Loxodonta africana", "Elefante africano"),
    ("Elephas maximus", "Elefante asiático"),
    ("Giraffa camelopardalis", "Jirafa"),
    ("Hippopotamus amphibius", "Hipopótamo"),
    ("Equus ferus", "Caballo"),
    ("Equus zebra", "Cebra"),
    ("Sus scrofa", "Jabalí"),
    ("Bos taurus", "Vaca"),
    ("Ovis aries", "Oveja"),
    ("Capra pyrenaica", "Cabra montés ibérica"),
    ("Camelus dromedarius", "Dromedario"),
    ("Delphinus delphis", "Delfín común"),
    ("Orcinus orca", "Orca"),
    ("Balaenoptera musculus", "Ballena azul"),
    ("Megaptera novaeangliae", "Ballena jorobada"),
    ("Monodon monoceros", "Narval"),
    ("Carcharodon carcharias", "Tiburón blanco"),
    ("Rhincodon typus", "Tiburón ballena"),
    ("Sphyrna zygaena", "Tiburón martillo"),
    ("Chelonia mydas", "Tortuga verde"),
    ("Dermochelys coriacea", "Tortuga laúd"),
    ("Crocodylus niloticus", "Cocodrilo del Nilo"),
    ("Alligator mississippiensis", "Aligátor americano"),
    ("Varanus komodoensis", "Dragón de Komodo"),
    ("Iguana iguana", "Iguana verde"),
    ("Ophiophagus hannah", "Cobra real"),
    ("Falco peregrinus", "Halcón peregrino"),
    ("Aquila chrysaetos", "Águila real"),
    ("Struthio camelus", "Avestruz"),
    ("Pavo cristatus", "Pavo real"),
    ("Corvus corax", "Cuervo grande"),
    ("Gyps fulvus", "Buitre leonado"),
    ("Aptenodytes forsteri", "Pingüino emperador"),
    ("Cygnus olor", "Cisne blanco"),
    ("Anas platyrhynchos", "Ánade real"),
    ("Passer domesticus", "Gorrión común"),
    ("Pelophylax perezi", "Rana común"),
    ("Salamandra salamandra", "Salamandra común"),
    ("Ambystoma mexicanum", "Ajolote"),
    ("Phoca vitulina", "Foca común"),
    ("Otaria flavescens", "León marino sudamericano"),
    ("Odobenus rosmarus", "Morsa"),
    ("Macropus rufus", "Canguro rojo"),
    ("Phascolarctos cinereus", "Koala"),
    ("Ornithorhynchus anatinus", "Ornitorrinco"),
    ("Tachyglossus aculeatus", "Equidna"),
    ("Rattus norvegicus", "Rata parda"),
    ("Mus musculus", "Ratón de laboratorio"),
    ("Mustela nivalis", "Comadreja"),
    ("Rhinoceros unicornis", "Rinoceronte indio"),
    ("Diceros bicornis", "Rinoceronte negro"),
    ("Gavialis gangeticus", "Gavial"),
    ("Columba livia", "Paloma bravía"),
    ("Tyto alba", "Lechuza común"),
    ("Pelecanus onocrotalus", "Pelícano blanco"),
    ("Ara macao", "Guacamayo rojo"),
    ("Myiopsitta monachus", "Cotorra argentina"),
    ("Phoenicopterus roseus", "Flamenco rosado"),
    ("Danaus plexippus", "Mariposa monarca"),
    ("Apis mellifera", "Abeja europea"),
    ("Atta cephalotes", "Hormiga cortadora de hojas"), #############################
    ("Latrodectus mactans", "Viuda negra"),
    ("Lycosa tarantula", "Tarántula europea"),
    ("Buthus occitanus", "Escorpión"),
    ("Carcinus maenas", "Cangrejo verde"),
    ("Palinurus elephas", "Langosta europea"),
    ("Homarus americanus", "Bogavante americano"),
    ("Octopus vulgaris", "Pulpo común"),
    ("Architeuthis dux", "Calamar gigante"),
    ("Nautilus pompilius", "Nautilo"),
    ("Aplysia californica", "Liebre de mar"),
    ("Electrophorus electricus", "Anguila eléctrica"),
    ("Limulus polyphemus", "Cangrejo herradura"),
    ("Salmo salar", "Salmón común"),
    ("Physalia physalis", "Carabela portuguesa"),
    ("Hydra vulgaris", "Hidra"),
    ("Nematostella vectensis", "Anémona estrella"),
    ("Acanthaster planci", "Estrella corona de espinas"),
    ("Strongylocentrotus purpuratus", "Erizo púrpura"),
    ("Paracentrotus lividus", "Erizo de mar común"),
    ("Holothuria forskali", "Pepino de mar"),
    ("Eucidaris tribuloides", "Erizo lápiz"),
    ("Euplectella aspergillum", "Esponja Venus"),
    ("Spongia officinalis", "Esponja de baño"),
    ("Sabella spallanzanii", "Gusano pluma"),
    ("Platynereis dumerilii", "Gusano poliqueto")
]

print(len(SEED))


def safe_get(url):
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json()
        else:
            print("WARNING:", r.status_code, "for", url)
    except Exception as e:
        print("ERROR:", e, "for", url)
    return None

out = []
for name, display in SEED:
    print("Procesando:", name)
    m = safe_get(GBIF_MATCH + requests.utils.requote_uri(name))
    time.sleep(DELAY)
    if not m or not m.get("usageKey"):
        print("  → No match válido, se salta:", name)
        continue
    key = m["usageKey"]
    d = safe_get(GBIF_SPECIES + str(key))
    time.sleep(DELAY)
    if not d:
        print("  → No detalles, se salta:", name)
        continue

    sci = d.get("species", name)

    taxonomy = {
        "phylum": d.get("phylum",""),
        "class": d.get("class",""),
        "order": d.get("order",""),
        "family": d.get("family",""),
        "genus": d.get("genus",""),
        "species": d.get("species", sci)
    }

    entry = {
        "id": sci,
        "display": display,
        "sci": sci,
        "taxonomy": taxonomy
    }
    out.append(entry)
    print("  → Añadido:", entry["id"])

print("Total especies válidas:", len(out))
with open(OUTPUT_FILE, "w", encoding="utf8") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
print("JSON generado:", OUTPUT_FILE)

