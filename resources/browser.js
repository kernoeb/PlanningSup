/**
 *
 * FOR USING
 * Copy and paste this code in your browser console
 * and enter
 *
 * Open the entire folder hierarchy
 * then click on the topmost folder
 * the script will copy the result
 * kernoeb X Matisse X ShockedPlot7560
 *
 */

const characterMap = { À: 'A', Á: 'A', Â: 'A', Ã: 'A', Ä: 'A', Å: 'A', Ấ: 'A', Ắ: 'A', Ẳ: 'A', Ẵ: 'A', Ặ: 'A', Æ: 'AE', Ầ: 'A', Ằ: 'A', Ȃ: 'A', Ç: 'C', Ḉ: 'C', È: 'E', É: 'E', Ê: 'E', Ë: 'E', Ế: 'E', Ḗ: 'E', Ề: 'E', Ḕ: 'E', Ḝ: 'E', Ȇ: 'E', Ì: 'I', Í: 'I', Î: 'I', Ï: 'I', Ḯ: 'I', Ȋ: 'I', Ð: 'D', Ñ: 'N', Ò: 'O', Ó: 'O', Ô: 'O', Õ: 'O', Ö: 'O', Ø: 'O', Ố: 'O', Ṍ: 'O', Ṓ: 'O', Ȏ: 'O', Ù: 'U', Ú: 'U', Û: 'U', Ü: 'U', Ý: 'Y', à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a', ấ: 'a', ắ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a', æ: 'ae', ầ: 'a', ằ: 'a', ȃ: 'a', ç: 'c', ḉ: 'c', è: 'e', é: 'e', ê: 'e', ë: 'e', ế: 'e', ḗ: 'e', ề: 'e', ḕ: 'e', ḝ: 'e', ȇ: 'e', ì: 'i', í: 'i', î: 'i', ï: 'i', ḯ: 'i', ȋ: 'i', ð: 'd', ñ: 'n', ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o', ø: 'o', ố: 'o', ṍ: 'o', ṓ: 'o', ȏ: 'o', ù: 'u', ú: 'u', û: 'u', ü: 'u', ý: 'y', ÿ: 'y', Ā: 'A', ā: 'a', Ă: 'A', ă: 'a', Ą: 'A', ą: 'a', Ć: 'C', ć: 'c', Ĉ: 'C', ĉ: 'c', Ċ: 'C', ċ: 'c', Č: 'C', č: 'c', C̆: 'C', c̆: 'c', Ď: 'D', ď: 'd', Đ: 'D', đ: 'd', Ē: 'E', ē: 'e', Ĕ: 'E', ĕ: 'e', Ė: 'E', ė: 'e', Ę: 'E', ę: 'e', Ě: 'E', ě: 'e', Ĝ: 'G', Ǵ: 'G', ĝ: 'g', ǵ: 'g', Ğ: 'G', ğ: 'g', Ġ: 'G', ġ: 'g', Ģ: 'G', ģ: 'g', Ĥ: 'H', ĥ: 'h', Ħ: 'H', ħ: 'h', Ḫ: 'H', ḫ: 'h', Ĩ: 'I', ĩ: 'i', Ī: 'I', ī: 'i', Ĭ: 'I', ĭ: 'i', Į: 'I', į: 'i', İ: 'I', ı: 'i', Ĳ: 'IJ', ĳ: 'ij', Ĵ: 'J', ĵ: 'j', Ķ: 'K', ķ: 'k', Ḱ: 'K', ḱ: 'k', K̆: 'K', k̆: 'k', Ĺ: 'L', ĺ: 'l', Ļ: 'L', ļ: 'l', Ľ: 'L', ľ: 'l', Ŀ: 'L', ŀ: 'l', Ł: 'l', ł: 'l', Ḿ: 'M', ḿ: 'm', M̆: 'M', m̆: 'm', Ń: 'N', ń: 'n', Ņ: 'N', ņ: 'n', Ň: 'N', ň: 'n', ŉ: 'n', N̆: 'N', n̆: 'n', Ō: 'O', ō: 'o', Ŏ: 'O', ŏ: 'o', Ő: 'O', ő: 'o', Œ: 'OE', œ: 'oe', P̆: 'P', p̆: 'p', Ŕ: 'R', ŕ: 'r', Ŗ: 'R', ŗ: 'r', Ř: 'R', ř: 'r', R̆: 'R', r̆: 'r', Ȓ: 'R', ȓ: 'r', Ś: 'S', ś: 's', Ŝ: 'S', ŝ: 's', Ş: 'S', Ș: 'S', ș: 's', ş: 's', Š: 'S', š: 's', Ţ: 'T', ţ: 't', ț: 't', Ț: 'T', Ť: 'T', ť: 't', Ŧ: 'T', ŧ: 't', T̆: 'T', t̆: 't', Ũ: 'U', ũ: 'u', Ū: 'U', ū: 'u', Ŭ: 'U', ŭ: 'u', Ů: 'U', ů: 'u', Ű: 'U', ű: 'u', Ų: 'U', ų: 'u', Ȗ: 'U', ȗ: 'u', V̆: 'V', v̆: 'v', Ŵ: 'W', ŵ: 'w', Ẃ: 'W', ẃ: 'w', X̆: 'X', x̆: 'x', Ŷ: 'Y', ŷ: 'y', Ÿ: 'Y', Y̆: 'Y', y̆: 'y', Ź: 'Z', ź: 'z', Ż: 'Z', ż: 'z', Ž: 'Z', ž: 'z', ſ: 's', ƒ: 'f', Ơ: 'O', ơ: 'o', Ư: 'U', ư: 'u', Ǎ: 'A', ǎ: 'a', Ǐ: 'I', ǐ: 'i', Ǒ: 'O', ǒ: 'o', Ǔ: 'U', ǔ: 'u', Ǖ: 'U', ǖ: 'u', Ǘ: 'U', ǘ: 'u', Ǚ: 'U', ǚ: 'u', Ǜ: 'U', ǜ: 'u', Ứ: 'U', ứ: 'u', Ṹ: 'U', ṹ: 'u', Ǻ: 'A', ǻ: 'a', Ǽ: 'AE', ǽ: 'ae', Ǿ: 'O', ǿ: 'o', Þ: 'TH', þ: 'th', Ṕ: 'P', ṕ: 'p', Ṥ: 'S', ṥ: 's', X́: 'X', x́: 'x', Ѓ: 'Г', ѓ: 'г', Ќ: 'К', ќ: 'к', A̋: 'A', a̋: 'a', E̋: 'E', e̋: 'e', I̋: 'I', i̋: 'i', Ǹ: 'N', ǹ: 'n', Ồ: 'O', ồ: 'o', Ṑ: 'O', ṑ: 'o', Ừ: 'U', ừ: 'u', Ẁ: 'W', ẁ: 'w', Ỳ: 'Y', ỳ: 'y', Ȁ: 'A', ȁ: 'a', Ȅ: 'E', ȅ: 'e', Ȉ: 'I', ȉ: 'i', Ȍ: 'O', ȍ: 'o', Ȑ: 'R', ȑ: 'r', Ȕ: 'U', ȕ: 'u', B̌: 'B', b̌: 'b', Č̣: 'C', č̣: 'c', Ê̌: 'E', ê̌: 'e', F̌: 'F', f̌: 'f', Ǧ: 'G', ǧ: 'g', Ȟ: 'H', ȟ: 'h', J̌: 'J', ǰ: 'j', Ǩ: 'K', ǩ: 'k', M̌: 'M', m̌: 'm', P̌: 'P', p̌: 'p', Q̌: 'Q', q̌: 'q', Ř̩: 'R', ř̩: 'r', Ṧ: 'S', ṧ: 's', V̌: 'V', v̌: 'v', W̌: 'W', w̌: 'w', X̌: 'X', x̌: 'x', Y̌: 'Y', y̌: 'y', A̧: 'A', a̧: 'a', B̧: 'B', b̧: 'b', Ḑ: 'D', ḑ: 'd', Ȩ: 'E', ȩ: 'e', Ɛ̧: 'E', ɛ̧: 'e', Ḩ: 'H', ḩ: 'h', I̧: 'I', i̧: 'i', Ɨ̧: 'I', ɨ̧: 'i', M̧: 'M', m̧: 'm', O̧: 'O', o̧: 'o', Q̧: 'Q', q̧: 'q', U̧: 'U', u̧: 'u', X̧: 'X', x̧: 'x', Z̧: 'Z', z̧: 'z' }

const chars = Object.keys(characterMap).join('|')
const allAccents = new RegExp(chars, 'g')

const URL = 'https://planning.univ-ubs.fr/jsp/custom/modules/plannings/anonymous_cal.jsp'

function matcher (match) {
  return characterMap[match]
}

const removeAccents = function (string) {
  return string.replace(allAccents, matcher)
}

const cleanText = function (string) {
  return removeAccents(string.replace(/\//gi, '').replace(/&/gi, '').replace(/,/gi, '').replace(/[()]/gi, '').replace(/\s/gi, '')).toLowerCase()
}

function strClipboard (a, b) {
  const t = document.createElement('TEXTAREA')
  t.textContent = a
  document.body.appendChild(t)
  t.select()
  document.execCommand('copy')
  t.parentNode.removeChild(t)
  if (typeof b === 'function') {
    b(a)
  }
}

function listener () {
  const e = document.activeElement
  let baseLevel
  let buffer
  let childSubDiv
  let good
  if (e.getAttribute('aria-activedescendant') !== null) {
    const idTemp = e.getAttribute('aria-activedescendant').split('-')[2]

    const parrent = document.getElementById(`Direct Planning Tree_x-auto-${idTemp}`)
    const parrentSubDiv = parrent.children[0].children[0].children[0].children[1].children[0].children[0]

    let child = parrent.nextSibling
    let childLevel = parseInt(child.getAttribute('aria-level'))
    const parrentLevel = parseInt(parrent.getAttribute('aria-level'))
    let previousChildLevel = parrentLevel

    const folderLabel = parrentSubDiv.children[0].children[4].innerHTML
    let childLabel = folderLabel

    const t = []

    t.push({
      id: cleanText(folderLabel),
      title: folderLabel,
      edts: []
    })
    let tTemp = t
    const keys = []

    baseLevel = parrentLevel

    let i = 0
    while (childLevel > parrentLevel && i < 100) {
      if (previousChildLevel < childLevel) {
        tTemp.forEach((element, index) => {
          if (element.title === childLabel && tTemp[index].edts !== null) {
            tTemp = tTemp[index].edts
          }
        })
        keys.push(childLabel)
      } else if (previousChildLevel > childLevel) {
        tTemp = t
        keys.forEach((key, index) => {
          if (index < keys.length - (previousChildLevel - childLevel)) {
            tTemp.forEach((element, index2) => {
              if (element.title === key && tTemp[index2].edts !== null) {
                tTemp = tTemp[index2].edts
              }
            })
          }
        })
        buffer = [].concat(keys)
        buffer.forEach((key3, index3) => {
          if (index3 >= childLevel - baseLevel) {
            keys.pop()
          }
        })
      }

      childSubDiv = child.children[0].children[0].children[0].children[1].children[0].children[0]
      childLabel = childSubDiv.children[0].children[4].innerHTML
      const childId = parseInt(childSubDiv.getAttribute('id').split('_')[1])
      const isFolder = childSubDiv.children[0].children[1].getAttribute('onload') !== null
      if (isFolder) {
        good = false
        tTemp.forEach((key, index) => {
          if (key.title === childLabel) {
            tTemp.push({
              id: cleanText(childLabel),
              title: childLabel,
              edts: []
            })
            good = true
          }
        })
        if (good === false) {
          tTemp.push({
            id: cleanText(childLabel),
            title: childLabel,
            edts: []
          })
        }
      } else {
        tTemp.push({
          id: cleanText(childLabel),
          title: childLabel,
          url: `${URL}?resources=${childId}&projectId=0&calType=ical&firstDate=2021-11-01&lastDate=2025-12-31`
        })
      }

      child = child.nextSibling
      previousChildLevel = childLevel
      childLevel = parseInt(child.getAttribute('aria-level'))
      i++
    }

    strClipboard(JSON.stringify(t), function (str) {
      alert('Copié dans le presse-papier avec succès')
    })
  }
}

document.addEventListener('mousedown', listener, true)
