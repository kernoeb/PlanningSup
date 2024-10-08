<template>
  <div>
    <v-snackbar
      v-model="showSnackbar"
      :timeout="3000"
      absolute
      top
      color="teal"
      right
    >
      {{ $config.i18n.copiedToClipboard }}
    </v-snackbar>
    <v-snackbar
      v-model="showSnackbarError"
      :timeout="3000"
      absolute
      top
      color="error"
      right
    >
      {{ $config.i18n.error }}
    </v-snackbar>
    <v-card>
      <v-toolbar
        class="toolbar_edt"
        flat
      >
        <v-card-title class="headline">
          <v-icon class="mr-3">
            {{ mdiCalendar }}
          </v-icon>
          <div>
            <div style="font-size: 15px; height: 20px;">
              {{ $config.i18n.chooseEdt }}
            </div>
            <div style="font-size: 12px;">
              {{ (localPlannings && localPlannings.length) || 0 }} sélectionné{{ (localPlannings && localPlannings.length) > 1 ? 's' : '' }}
            </div>
          </div>
        </v-card-title>
        <v-spacer />
        <v-menu
          v-model="menuGroup"
          :close-on-content-click="false"
          offset-y
          left
          :close-on-click="false"
        >
          <template #activator="{ on: menu, attrs }">
            <v-btn
              v-tooltip="$config.i18n.createFavoritesGroup"
              icon
              v-bind="attrs"
              v-on="menu"
            >
              <v-icon>{{ mdiFormatListGroup }}</v-icon>
            </v-btn>
          </template>
          <v-card width="300">
            <v-card-text>
              <v-text-field
                v-model="newFavoriteGroupName"
                autofocus
                label="Nom du groupe"
                :rules="favoriteGroupNameRules"
                @keyup.enter="() => { if (isFavoriteGroupRulesOk) { createFavoriteGroup() } }"
              />
              <span v-if="localPlannings?.length > 1">{{ localPlannings?.length || 0 }} plannings seront ajoutés au groupe</span>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn
                text
                :disabled="!isFavoriteGroupRulesOk"
                @click="createFavoriteGroup"
              >
                {{ $config.i18n.create }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-menu>
        <v-btn
          v-if="!$vuetify.breakpoint.mobile"
          v-tooltip="$config.i18n.copySelection"
          icon
          @click="copyTextToClipboard()"
        >
          <v-icon>{{ mdiContentCopy }}</v-icon>
        </v-btn>
        <v-btn
          v-tooltip="$config.i18n.resetSelection"
          icon
          @click="reset()"
        >
          <v-icon>{{ mdiRestore }}</v-icon>
        </v-btn>
        <v-btn
          icon
          @click="$emit('close')"
        >
          <v-icon>{{ mdiClose }}</v-icon>
        </v-btn>
      </v-toolbar>

      <v-divider />

      <v-text-field
        v-model.trim="searchCalendar"
        :label="$config.i18n.searchPlanning"
        filled
        clearable
        :clear-icon="mdiClose"
        hide-details
        dense
      />
      <div style="max-height: calc(90vh - 300px); overflow: auto;">
        <transition name="fade">
          <div
            v-if="Object.keys(favorites).length || groupFavorites?.length"
            class="pa-2"
          >
            <v-card flat>
              <v-card-title>
                <v-icon
                  color="orange"
                  class="mt-n1 mr-1"
                >
                  {{ mdiStar }}
                </v-icon>
                <span class="text-h6 font-weight-bold">Favoris</span>
              </v-card-title>
              <v-card-text>
                <v-list
                  rounded
                  dense
                >
                  <transition-group
                    name="list-complete"
                    tag="div"
                  >
                    <!-- Group favorites list -->
                    <v-list-item
                      v-for="(groupFavorite, i) in groupFavorites"
                      :key="`group-${i}-${groupFavorite.name}`"
                      dense
                      style="height: 20px;"
                      class="list-complete-item"
                      link
                      @click="localPlannings = groupFavorite.plannings || []; updatePlannings(); $emit('close');"
                    >
                      <v-list-item-content>
                        <v-list-item-title>
                          <v-icon
                            x-small
                            color="primary"
                            class="mr-1"
                          >
                            {{ mdiFormatListGroup }}
                          </v-icon>{{ groupFavorite.name }}
                        </v-list-item-title>
                        <v-list-item-subtitle>
                          {{ groupFavorite.plannings?.length || 0 }} plannings
                        </v-list-item-subtitle>
                      </v-list-item-content>
                      <v-list-item-action>
                        <div>
                          <v-menu
                            v-model="favoriteRenameMenus[groupFavorite]"
                            :close-on-content-click="false"
                            offset-y
                            left
                          >
                            <template #activator="{ on: menu, attrs }">
                              <v-btn
                                small
                                icon
                                v-bind="attrs"
                                v-on="menu"
                                @click="newFavoriteName = groupFavorite.name"
                              >
                                <v-icon small>
                                  {{ mdiPencil }}
                                </v-icon>
                              </v-btn>
                            </template>
                            <v-card width="300">
                              <v-card-text>
                                <v-text-field
                                  v-model="newFavoriteName"
                                  autofocus
                                  label="Nom du favori"
                                  :rules="favoriteNameRules"
                                  @keyup.enter="() => { if (isFavoriteNameRulesOk) { renameFavoriteGroup(groupFavorite) } }"
                                />
                              </v-card-text>
                              <v-card-actions>
                                <v-spacer />
                                <v-btn
                                  text
                                  :disabled="!isFavoriteNameRulesOk"
                                  @click="renameFavoriteGroup(groupFavorite)"
                                >
                                  {{ $config.i18n.rename }}
                                </v-btn>
                              </v-card-actions>
                            </v-card>
                          </v-menu>
                          <v-btn
                            small
                            icon
                            @click="deleteFavoriteGroup(i)"
                          >
                            <v-icon
                              small
                              color="red"
                            >
                              {{ mdiDelete }}
                            </v-icon>
                          </v-btn>
                        </div>
                      </v-list-item-action>
                    </v-list-item>

                    <!-- Favorites list -->
                    <v-list-item
                      v-for="(favorite, i) in Object.keys(favorites)"
                      :key="`${i}-${favorites[favorite]}`"
                      dense
                      style="height: 20px;"
                      class="list-complete-item"
                      link
                      @click="localPlannings = [favorite]; updatePlannings(); $emit('close');"
                    >
                      <v-list-item-content>
                        <v-list-item-title>{{ getFavoriteName(favorite) }}</v-list-item-title>
                      </v-list-item-content>
                      <v-list-item-action>
                        <div>
                          <v-menu
                            v-model="favoriteRenameMenus[favorite]"
                            :close-on-content-click="false"
                            offset-y
                            left
                          >
                            <template #activator="{ on: menu, attrs }">
                              <v-btn
                                small
                                icon
                                v-bind="attrs"
                                v-on="menu"
                                @click="newFavoriteName = getFavoriteName(favorite)"
                              >
                                <v-icon small>
                                  {{ mdiPencil }}
                                </v-icon>
                              </v-btn>
                            </template>
                            <v-card width="300">
                              <v-card-text>
                                <v-text-field
                                  v-model="newFavoriteName"
                                  autofocus
                                  :label="$config.i18n.favoriteName"
                                  :rules="favoriteNameRules"
                                  @keyup.enter="() => { if (isFavoriteNameRulesOk) { renameFavorite(favorite) } }"
                                />
                              </v-card-text>
                              <v-card-actions>
                                <v-spacer />
                                <v-btn
                                  text
                                  :disabled="!isFavoriteNameRulesOk"
                                  @click="renameFavorite(favorite)"
                                >
                                  {{ $config.i18n.rename }}
                                </v-btn>
                              </v-card-actions>
                            </v-card>
                          </v-menu>
                          <v-btn
                            small
                            icon
                            @click="removeFavorite(favorite)"
                          >
                            <v-icon
                              small
                              color="red"
                            >
                              {{ mdiDelete }}
                            </v-icon>
                          </v-btn>
                        </div>
                      </v-list-item-action>
                    </v-list-item>
                  </transition-group>
                </v-list>
              </v-card-text>
            </v-card>
          </div>
        </transition>
        <div>
          <div
            v-if="urls"
            class="mb-2"
          >
            <v-treeview
              :expand-icon="mdiMenuDown"
              :filter="filter"
              :items="urls"
              :search="searchCalendar"
              class="treeview_plannings"
              dense
              open-on-click
              item-children="edts"
              item-key="fullId"
              item-text="title"
              transition
            >
              <template #label="{ item }">
                <div class="d-flex justify-space-between">
                  <div
                    :class="(item && item.fullId && localPlannings.some(v => v.startsWith(item.fullId))) ? 'selected_planning' : ''"
                    style="width: 100%;"
                  >
                    <v-checkbox
                      v-if="!item.edts"
                      v-model="localPlannings"
                      :title="item.fullId"
                      color="#2196F3"
                      :value="item.fullId"
                      :indeterminate-icon="mdiCheckboxBlankOutline"
                      :off-icon="mdiCheckboxBlankOutline"
                      :on-icon="mdiCheckboxMarked"
                      :label="item.title"
                    />
                    <div v-else>
                      {{ item.title }}
                    </div>
                  </div>
                  <v-hover
                    v-if="!item.edts"
                    v-slot="{ hover }"
                  >
                    <v-btn
                      icon
                      style="margin-top: 2px;"
                      @click="toggleFavorite(item.fullId)"
                    >
                      <v-icon
                        v-if="(Object.keys(favorites) || []).includes(item.fullId)"
                        color="orange"
                      >
                        {{ mdiStar }}
                      </v-icon>
                      <v-icon
                        v-else
                        :color="hover ? 'orange' : 'grey lighten-2'"
                      >
                        {{ mdiStarOutline }}
                      </v-icon>
                    </v-btn>
                  </v-hover>
                </div>
              </template>
            </v-treeview>
          </div>
          <div
            v-else
            style="min-height: 330px;"
            class="d-flex justify-center align-center"
          >
            <v-progress-circular
              indeterminate
              color="yellow darken-2"
            />
          </div>
        </div>
      </div>

      <v-btn
        block
        :disabled="disabledValidate"
        @click="updatePlannings()"
      >
        Valider
      </v-btn>
    </v-card>
  </div>
</template>

<script>
import {
  mdiCalendar,
  mdiCheckboxBlankOutline,
  mdiCheckboxMarked,
  mdiClose,
  mdiContentCopy,
  mdiDelete,
  mdiFormatListGroup,
  mdiMenuDown,
  mdiMinusBox,
  mdiStar,
  mdiStarHalfFull,
  mdiStarOutline,
  mdiPencil,
  mdiRestore
} from '@mdi/js'

export default {
  name: 'SelectPlanning',
  props: {
    selectedPlannings: {
      type: Array,
      default: () => []
    },
    plannings: {
      type: Array,
      default: () => []
    },
    dialog: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      mdiCalendar,
      mdiCheckboxBlankOutline,
      mdiCheckboxMarked,
      mdiClose,
      mdiContentCopy,
      mdiDelete,
      mdiFormatListGroup,
      mdiMenuDown,
      mdiMinusBox,
      mdiStar,
      mdiStarHalfFull,
      mdiStarOutline,
      mdiPencil,
      mdiRestore,

      menuGroup: false,

      showSnackbar: false,
      showSnackbarError: false,
      searchCalendar: '',
      newFavoriteGroupName: '',

      favoriteRenameMenus: {},
      newFavoriteName: '',

      activatedPlanning: null,
      urls: null,

      localPlannings: [],
      favorites: {},
      groupFavorites: [],

      planningNames: null
    }
  },
  computed: {
    favoriteGroupNameRules () {
      return [
        (this.newFavoriteGroupName?.length || 0) > 0 || 'Le nom du groupe est requis',
        (this.newFavoriteGroupName?.length || 0) < 40 || 'Le nom du groupe doit faire moins de 50 caractères',
        !!this.localPlannings || 'Aucun planning sélectionné',
        this.localPlannings?.length !== 0 || 'Aucun planning sélectionné',
        this.localPlannings?.length > 1 || 'Sélectionnez au moins 2 plannings',
        !this.groupFavorites?.some(group => group.name === this.newFavoriteGroupName) || 'Ce nom de groupe est déjà utilisé'
      ]
    },
    isFavoriteGroupRulesOk () {
      return this.favoriteGroupNameRules.every(rule => rule === true)
    },
    favoriteNameRules () {
      return [
        (this.newFavoriteName?.length || 0) > 0 || 'Le nom du favori est requis',
        (this.newFavoriteName?.length || 0) < 40 || 'Le nom du favori doit faire moins de 50 caractères'
      ]
    },
    isFavoriteNameRulesOk () {
      return this.favoriteNameRules.every(rule => rule === true)
    },
    disabledValidate () {
      return JSON.stringify(this.localPlannings) === JSON.stringify(this.selectedPlannings)
    }
  },
  watch: {
    selectedPlannings: {
      handler (newVal, oldVal) {
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          this.localPlannings = newVal
        }
      },
      immediate: true
    }
  },
  created () {
    this.refreshFavorites()
  },
  mounted () {
    window.addEventListener('keyup', this.keyup)

    this.$axios.$get('/api/v1/urls').then((data) => {
      this.urls = data
    }).catch((err) => {
      console.log(err)
    })
  },
  beforeDestroy () {
    window.removeEventListener('keyup', this.keyup)
  },
  methods: {
    keyup (event) {
      if (event.key === 'Enter' || event.keyCode === 13) {
        if (!this.disabledValidate && this.dialog) this.updatePlannings()
      }
    },
    // https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
    fallbackCopyTextToClipboard (text) {
      const textArea = document.createElement('textarea')
      textArea.value = text

      // Avoid scrolling to bottom
      textArea.style.top = '0'
      textArea.style.left = '0'
      textArea.style.position = 'fixed'

      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      try {
        const successful = document.execCommand('copy')
        const msg = successful ? 'successful' : 'unsuccessful'
        console.log('Fallback: Copying text command was ' + msg)
        this.showSnackbar = true
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err)
        this.showSnackbarError = true
      }

      document.body.removeChild(textArea)
    },
    copyTextToClipboard () {
      const { href } = location
      const text = (href.endsWith('/') ? href.slice(0, -1) : href) + '/?p=' + this.localPlannings.join(',')

      if (!navigator.clipboard) {
        this.fallbackCopyTextToClipboard(text)
        return
      }
      navigator.clipboard.writeText(text).then(() => {
        console.log('Async: Copying to clipboard was successful!')
        this.showSnackbar = true
      }, function (err) {
        console.error('Async: Could not copy text: ', err)
        this.showSnackbarError = true
      })
    },
    getNames () {
      const favoritesIds = Object.keys(this.favorites ?? {})
      const list = [...favoritesIds, ...(this.groupFavorites || []).map(v => v.plannings).flat()]
      if (list.length) {
        this.$axios.$get('/api/v1/calendars/info', { params: { p: list.join(',') } }).then((data) => {
          this.planningNames = data
        }).catch(() => {
          this.planningNames = []
        })
      }
    },
    reset () {
      this.localPlannings = []
      this.searchCalendar = ''
      this.newFavoriteGroupName = ''
      this.newFavoriteName = ''

      this.updatePlannings()
    },
    filter: (item, search, textKey) => item[textKey].toUpperCase().includes(search.toUpperCase()),
    updatePlannings () {
      this.$emit('selected-plannings', this.localPlannings)
    },
    addFavorite (id) {
      if (!(id in this.favorites)) {
        this.favorites[id] = null
        this.$cookies.set('favorites', this.favorites, { maxAge: 2147483646 })
        this.getNames()
        this.$nextTick(() => {
          this.refreshFavorites()
        })
      }
    },
    removeFavorite (id) {
      if (id in this.favorites) {
        this.$delete(this.favorites, id)
        this.$cookies.set('favorites', this.favorites, { maxAge: 2147483646 })

        this.getNames()
        this.$nextTick(() => {
          this.refreshFavorites()
        })
      }
    },
    toggleFavorite (id) {
      if (id in this.favorites) {
        this.removeFavorite(id)
      } else {
        this.addFavorite(id)
      }
    },
    getFavoriteName (favorite) {
      if (this.favorites[favorite]) return this.favorites[favorite]
      if (this.planningNames === null) return ''
      return this.planningNames?.find(v => v.planning === favorite)?.title || favorite
    },
    renameFavorite (favorite) {
      this.$set(this.favorites, favorite, this.newFavoriteName)
      this.$cookies.set('favorites', this.favorites, { maxAge: 2147483646 })
      this.newFavoriteName = ''
      this.favoriteRenameMenus[favorite] = false
    },
    renameFavoriteGroup (favoriteGroup) {
      const index = this.groupFavorites.findIndex(v => v.name === favoriteGroup.name)
      this.$set(this.groupFavorites[index], 'name', this.newFavoriteName)
      this.$cookies.set('group-favorites', this.groupFavorites, { maxAge: 2147483646 })
      this.newFavoriteName = ''
      this.favoriteRenameMenus[favoriteGroup] = false
    },
    createFavoriteGroup () {
      if (!this.newFavoriteGroupName) return
      // take all current plannings and add them to the new group
      const tmp = [...this.localPlannings]
      const currentGroupFavoriteList = this.$cookies.get('group-favorites') || []
      const newGroupFavoriteList = [...currentGroupFavoriteList, { name: this.newFavoriteGroupName, plannings: tmp }]
        .filter(v => !!v && !!v.name && !!v.plannings && v.plannings.length)
      this.$cookies.set('group-favorites', newGroupFavoriteList, { maxAge: 2147483646 })
      this.newFavoriteGroupName = ''
      this.refreshFavorites()
      this.menuGroup = false
    },
    deleteFavoriteGroup (index) {
      const currentGroupFavoriteList = this.$cookies.get('group-favorites') || []
      const newGroupFavoriteList = currentGroupFavoriteList
        .filter((v, i) => i !== index)
        .filter(v => !!v && !!v.name && !!v.plannings && v.plannings.length)
      this.$cookies.set('group-favorites', newGroupFavoriteList, { maxAge: 2147483646 })
      this.refreshFavorites()
      this.menuGroup = false
    },
    refreshFavorites () {
      try {
        try {
          let favorites = this.$cookies?.get('favorites') || {}

          // Convert old favorites to new format
          if (typeof favorites === 'string') {
            const oldFavorites = favorites.split(',')

            if (oldFavorites.length) {
              favorites = oldFavorites.reduce((acc, favorite) => {
                acc[favorite] = null
                return acc
              }, {})

              this.$cookies.set('favorites', favorites, { maxAge: 2147483646 })
            }
          }

          this.favorites = favorites
        } catch (err) {
          console.log('Error parsing favorites names', err)
          this.favorites = {}
        }

        try {
          this.groupFavorites = this.$cookies?.get('group-favorites')?.filter(v => !!v && !!v.name && !!v.plannings) || []
        } catch (err) {
          console.log('Error parsing group favorites', err)
          this.groupFavorites = []
        }

        this.getNames()

        if (this.$cookies?.get('favorites') === '') this.$cookies.remove('favorites')
        if (this.$cookies?.get('groupFavorites') === '') this.$cookies.remove('groupFavorites')
      } catch (err) {}
    }
  }
}
</script>

<style>
.v-treeview-node__level {
  width: 17px !important;
}
.accent--text svg {
  color:#2196F3 !important;
}
.treeview_plannings.theme--light .v-treeview-node__root .v-treeview-node__level::before {
  border: 0.5px dashed rgba(211, 196, 196, 0.7) !important;
}

.treeview_plannings .v-treeview-node__root .v-treeview-node__level::before {
  border: 0.5px dashed rgba(211, 196, 196, 0.3) !important;
}

.treeview_plannings .v-treeview-node__root .v-treeview-node__level::before {
  height: 38px !important;
  content: '' !important;
  margin-left: 10px !important;
  display: flex !important;
  width: 0!important;
}

.treeview_plannings .v-input__slot {
  margin-bottom: 0!important;
  min-height: 40px;
  padding-left: 8px;
 }
.treeview_plannings .v-messages {
  display: none!important;
}
.treeview_plannings .v-input--selection-controls {
  margin-top: 0!important;
  padding-top: 0!important;
}
.treeview_plannings .theme--light.v-label {
  color: inherit!important;
}

.list-complete-item {
  transition: all 0.4s;
}
.list-complete-enter, .list-complete-leave-to  {
  opacity: 0;
  transform: translateY(-30px);
}
.list-complete-leave-active {
  position: absolute;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity .5s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
</style>
