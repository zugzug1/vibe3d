/** Catalog / registry category for F1 Kit (`f1-*`) models. */

export function categoryFromId(id: string): string {
  if (id.includes('hot-wheels')) return 'Exhibition Track'
  if (id.includes('service-truck')) return 'Vehicles'
  if (
    id.includes('trophy')
    || id.includes('champagne')
    || id.includes('ice-bucket')
    || id.includes('interview')
    || id.includes('cooldown')
  ) return 'Ceremony'
  if (
    id.includes('led-ribbon')
    || id.includes('sector-board')
    || id.includes('nameboard')
  ) return 'Displays'
  if (id.includes('tyre')) return 'Tyres'
  if (id.includes('jack') || id.includes('gun') || id.includes('rack')) return 'Pit Tools'
  if (id.includes('cabinet') || id.includes('extinguisher') || id.includes('reel')) return 'Garage Equipment'
  if (
    id.includes('oranje')
    || id.includes('catch-fence')
    || id.includes('crowd-fence')
    || id.includes('armco')
    || id.includes('tecpro')
    || id.includes('kerb')
    || id.includes('floodlight')
    || id.includes('timing-pylon')
    || id.includes('brake-marker')
    || id.includes('jumbotron')
    || id.includes('marshal')
    || id.includes('start-')
    || id.includes('grandstand')
    || id.includes('concrete-wall')
    || id.includes('jersey')
    || id.includes('access-gate')
    || id.includes('crash-cushion')
    || id.includes('gravel')
    || id.includes('astroturf')
    || id.includes('marker-post')
    || id.includes('slot-drain')
    || id.includes('stairs')
    || id.includes('circuit-sign')
    || id.includes('grid-box')
    || id.includes('fia-light')
    || id.includes('chevron')
    || id.includes('camera-tower')
    || id.includes('foam-monitor')
    || id.includes('cctv')
    || id.includes('pa-horn')
    || id.includes('race-control')
    || id.includes('spectator-bridge')
    || id.includes('podium')
    || id.includes('cone')
    || id.includes('bollard')
    || id.includes('weighbridge')
    || id.includes('parc-ferme')
    || id.includes('medical-post')
    || id.includes('generator')
    || id.includes('flag-pole')
    || id.includes('camera-platform')
    || id.includes('tunnel-portal')
    || id.includes('sector-gantry')
  ) return 'Trackside'
  if (id.includes('board') || id.includes('gantry')) return 'Signage & Structures'
  return 'Pit Lane'
}
