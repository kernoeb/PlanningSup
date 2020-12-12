export function getColor (n, l, m) {
  if (m) {
    if (n.startsWith('UE1')) {
      return '#f3352d'
    } else if (n.startsWith('UE2')) {
      return '#ffaa00'
    } else if (n.match(/^UE3.*android/)) {
      return 'rgb(94, 168, 212)'
    } else if (n.startsWith('UE3')) {
      return 'rgb(3, 119, 186)'
    } else if (n.match(/^UE4.*NoSQL/)) {
      return 'rgba(241, 79, 174, 0.616)'
    } else if (n.startsWith('UE4')) {
      return 'rgb(241, 79, 174)'
    } else if (n.startsWith('UE5')) {
      return '#00998a'
    } else if (n.startsWith('UE6')) {
      return '#3c4082'
    } else if (n.startsWith('UE7')) {
      return '#01a156'
    } else if (n.startsWith('UE8')) {
      return '#571a4e'
    } else if (n.startsWith('UE9')) {
      return '#607b8a'
    }
  }
  if (n.includes('CM') || n.includes('Amphi') || l.includes('Amphi')) {
    return '#fe463a'
  } else if (l.includes('à distance') || n.toUpperCase().includes('COVID')) {
    return '#a50e83'
  } else if (n.includes('TD') || l.includes('V-B')) {
    return 'green'
  } else if (n.includes('TP')) {
    return 'blue'
  } else {
    return 'orange'
  }
}

export function cleanDescription (d) {
  return d.replace(/Grp \d/g, '').replace(/GR \d.?\d?/g, '').replace(/LP (DLIS|CYBER)/g, '').replace(/\(Exporté.*\)/, '').trim()
}
