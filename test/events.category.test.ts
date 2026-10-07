import { beforeAll, describe, expect, it } from 'bun:test'

import { installApiDbMock } from './helpers/api-db-mock'

/**
 * Category inference (getCategoryId via getFormattedEvents, summary-only):
 * - ENSEA glued codes like 1G2TP1 / AL4-TD2
 * - no false positives on HTTP/SMTP or TP groups listed in description
 */

describe('event categoryId', () => {
  let getFormattedEvents: typeof import('@api/utils/events').getFormattedEvents

  beforeAll(async () => {
    installApiDbMock()
    ;({ getFormattedEvents } = await import('@api/utils/events'))
  })

  function categoryFor(summary: string, description = '', location = 'Room 1') {
    const events = getFormattedEvents(
      'ensea.inge_fise.1ereaensea.1g2td1.1g2tp1',
      [{
        uid: 'evt',
        summary,
        startDate: new Date('2026-10-09T08:00:00Z'),
        endDate: new Date('2026-10-09T10:00:00Z'),
        location,
        description,
      }],
      {
        localeUtils: null,
        filters: { blocklist: [], teachers: [], rooms: [], slots: [], hidden: [], timezone: 'Europe/Paris' },
        highlightTeacher: false,
      },
    )
    return events[0]!.categoryId
  }

  it('maps glued ENSEA TP code to lab', () => {
    expect(categoryFor('DEE_1301_Systèmes électroniques_1G2TP1', '1G2 TP1\nSABOURAUD-MULLER Carine')).toBe('lab')
  })

  it('maps glued ENSEA TD code to tutorial', () => {
    expect(categoryFor('DTI_1201_Analyse de Fourier 1A_1G2TD1', '1G2 TD1\nNICOLAU Florentina')).toBe('tutorial')
  })

  it('maps hyphenated TD code to tutorial', () => {
    expect(categoryFor('AL4-TD2')).toBe('tutorial')
  })

  it('leaves HTTP event as other', () => {
    expect(categoryFor('HTTP Request')).toBe('other')
  })

  it('keeps TD summary as tutorial even when description lists TP groups', () => {
    expect(categoryFor('3D930 - SGBDR - TD', 'TP1 / TP2 / TP3\nSome teacher')).toBe('tutorial')
  })

  it('does not treat "microcontrôleurs" as an exam', () => {
    expect(categoryFor('DTI_1501_Systèmes à microcontrôleurs_1G2TD1')).toBe('tutorial')
  })

  it('still treats contrôle and contrôles as exams', () => {
    expect(categoryFor('Contrôle Analyse TD1')).toBe('other')
    expect(categoryFor('Contrôles continus TD2')).toBe('other')
    expect(categoryFor('controle maths TD')).toBe('other')
  })
})
