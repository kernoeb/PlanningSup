export const state = () => ({
  selectedPlannings: []
})

function getParameter (b) {
  return Buffer.from(JSON.stringify(b), 'binary').toString('base64')
}

export const mutations = {
  addPlanning (state, planning) {
    if (state.selectedPlannings.includes(planning)) state.selectedPlannings = state.selectedPlannings.filter(v => v !== planning)
    else state.selectedPlannings.push(planning)
    this.$router.push({ name: 'index', query: { p: state.selectedPlannings && state.selectedPlannings.length ? getParameter(state.selectedPlannings) : undefined } })
  },
  setPlannings (state, plannings) {
    state.selectedPlannings = plannings
  }
}
