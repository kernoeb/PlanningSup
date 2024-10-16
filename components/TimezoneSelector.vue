<template>
  <div>
    <v-subheader
      class="my-3 pl-0"
      style="height: 20px"
    >
      Utiliser un fuseau horaire personnalisé
    </v-subheader>
    <v-autocomplete
      v-model="targetTz"
      :items="timezones"
      item-text="label"
      item-value="value"
      label="Chercher un fuseau horaire"
    >
      <template #item="{ item }">
        {{ item.label }}
      </template>
    </v-autocomplete>
  </div>
</template>

<script>
export default {
  name: 'TimezoneSelector',
  data () {
    return {
      timezones: [ // Merci StackOverflow pour la liste
        { label: '(GMT-12:00) International Date Line West', value: 'Etc/GMT+12' },
        { label: '(GMT-11:00) Midway Island, Samoa', value: 'Pacific/Midway' },
        { label: '(GMT-10:00) Hawaii', value: 'Pacific/Honolulu' },
        { label: '(GMT-09:00) Alaska', value: 'US/Alaska' },
        { label: '(GMT-08:00) Pacific Time (US & Canada)', value: 'America/Los_Angeles' },
        { label: '(GMT-08:00) Tijuana, Baja California', value: 'America/Tijuana' },
        { label: '(GMT-07:00) Arizona', value: 'US/Arizona' },
        { label: '(GMT-07:00) Chihuahua, La Paz, Mazatlan', value: 'America/Chihuahua' },
        { label: '(GMT-07:00) Mountain Time (US & Canada)', value: 'US/Mountain' },
        { label: '(GMT-06:00) Central America', value: 'America/Managua' },
        { label: '(GMT-06:00) Central Time (US & Canada)', value: 'US/Central' },
        { label: '(GMT-06:00) Guadalajara, Mexico City, Monterrey', value: 'America/Mexico_City' },
        { label: '(GMT-06:00) Saskatchewan', value: 'Canada/Saskatchewan' },
        { label: '(GMT-05:00) Bogota, Lima, Quito, Rio Branco', value: 'America/Bogota' },
        { label: '(GMT-05:00) Eastern Time (US & Canada)', value: 'US/Eastern' },
        { label: '(GMT-05:00) Indiana (East)', value: 'US/East-Indiana' },
        { label: '(GMT-04:00) Atlantic Time (Canada)', value: 'Canada/Atlantic' },
        { label: '(GMT-04:00) Caracas, La Paz', value: 'America/Caracas' },
        { label: '(GMT-04:00) Manaus', value: 'America/Manaus' },
        { label: '(GMT-04:00) Santiago', value: 'America/Santiago' },
        { label: '(GMT-03:30) Newfoundland', value: 'Canada/Newfoundland' },
        { label: '(GMT-03:00) Brasilia', value: 'America/Sao_Paulo' },
        { label: '(GMT-03:00) Buenos Aires, Georgetown', value: 'America/Argentina/Buenos_Aires' },
        { label: '(GMT-03:00) Greenland', value: 'America/Godthab' },
        { label: '(GMT-03:00) Montevideo', value: 'America/Montevideo' },
        { label: '(GMT-02:00) Mid-Atlantic', value: 'America/Noronha' },
        { label: '(GMT-01:00) Cape Verde Is.', value: 'Atlantic/Cape_Verde' },
        { label: '(GMT-01:00) Azores', value: 'Atlantic/Azores' },
        { label: '(GMT+00:00) Casablanca, Monrovia, Reykjavik', value: 'Africa/Casablanca' },
        { label: '(GMT+00:00) Dublin, Edinburgh, Lisbon, London', value: 'Europe/London' },
        { label: '(GMT+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna', value: 'Europe/Amsterdam' },
        { label: '(GMT+01:00) Belgrade, Bratislava, Budapest, Ljubljana, Prague', value: 'Europe/Belgrade' },
        { label: '(GMT+01:00) Brussels, Copenhagen, Madrid, Paris', value: 'Europe/Paris' },
        { label: '(GMT+01:00) Sarajevo, Skopje, Warsaw, Zagreb', value: 'Europe/Sarajevo' },
        { label: '(GMT+01:00) West Central Africa', value: 'Africa/Lagos' },
        { label: '(GMT+02:00) Amman', value: 'Asia/Amman' },
        { label: '(GMT+02:00) Athens, Bucharest, Istanbul', value: 'Europe/Athens' },
        { label: '(GMT+02:00) Beirut', value: 'Asia/Beirut' },
        { label: '(GMT+02:00) Cairo', value: 'Africa/Cairo' },
        { label: '(GMT+02:00) Harare, Pretoria', value: 'Africa/Harare' },
        { label: '(GMT+02:00) Helsinki, Kyiv, Riga, Sofia, Tallinn, Vilnius', value: 'Europe/Helsinki' },
        { label: '(GMT+02:00) Jerusalem', value: 'Asia/Jerusalem' },
        { label: '(GMT+02:00) Minsk', value: 'Europe/Minsk' },
        { label: '(GMT+02:00) Windhoek', value: 'Africa/Windhoek' },
        { label: '(GMT+03:00) Kuwait, Riyadh, Baghdad', value: 'Asia/Kuwait' },
        { label: '(GMT+03:00) Moscow, St. Petersburg, Volgograd', value: 'Europe/Moscow' },
        { label: '(GMT+03:00) Nairobi', value: 'Africa/Nairobi' },
        { label: '(GMT+03:00) Tbilisi', value: 'Asia/Tbilisi' },
        { label: '(GMT+03:30) Tehran', value: 'Asia/Tehran' },
        { label: '(GMT+04:00) Abu Dhabi, Muscat', value: 'Asia/Muscat' },
        { label: '(GMT+04:00) Baku', value: 'Asia/Baku' },
        { label: '(GMT+04:00) Yerevan', value: 'Asia/Yerevan' },
        { label: '(GMT+04:30) Kabul', value: 'Asia/Kabul' },
        { label: '(GMT+05:00) Yekaterinburg', value: 'Asia/Yekaterinburg' },
        { label: '(GMT+05:00) Islamabad, Karachi, Tashkent', value: 'Asia/Karachi' },
        { label: '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi', value: 'Asia/Calcutta' },
        { label: '(GMT+05:30) Sri Jayawardenapura', value: 'Asia/Kolkata' },
        { label: '(GMT+05:45) Kathmandu', value: 'Asia/Katmandu' },
        { label: '(GMT+06:00) Almaty, Novosibirsk', value: 'Asia/Almaty' },
        { label: '(GMT+06:00) Astana, Dhaka', value: 'Asia/Dhaka' },
        { label: '(GMT+06:30) Yangon (Rangoon)', value: 'Asia/Rangoon' },
        { label: '(GMT+07:00) Bangkok, Hanoi, Jakarta', value: 'Asia/Bangkok' },
        { label: '(GMT+07:00) Krasnoyarsk', value: 'Asia/Krasnoyarsk' },
        { label: '(GMT+08:00) Beijing, Chongqing, Hong Kong, Urumqi', value: 'Asia/Hong_Kong' },
        { label: '(GMT+08:00) Kuala Lumpur, Singapore', value: 'Asia/Kuala_Lumpur' },
        { label: '(GMT+08:00) Irkutsk, Ulaan Bataar', value: 'Asia/Irkutsk' },
        { label: '(GMT+08:00) Perth', value: 'Australia/Perth' },
        { label: '(GMT+08:00) Taipei', value: 'Asia/Taipei' },
        { label: '(GMT+09:00) Osaka, Sapporo, Tokyo', value: 'Asia/Tokyo' },
        { label: '(GMT+09:00) Seoul', value: 'Asia/Seoul' },
        { label: '(GMT+09:00) Yakutsk', value: 'Asia/Yakutsk' },
        { label: '(GMT+09:30) Adelaide', value: 'Australia/Adelaide' },
        { label: '(GMT+09:30) Darwin', value: 'Australia/Darwin' },
        { label: '(GMT+10:00) Brisbane', value: 'Australia/Brisbane' },
        { label: '(GMT+10:00) Canberra, Melbourne, Sydney', value: 'Australia/Canberra' },
        { label: '(GMT+10:00) Hobart', value: 'Australia/Hobart' },
        { label: '(GMT+10:00) Guam, Port Moresby', value: 'Pacific/Guam' },
        { label: '(GMT+10:00) Vladivostok', value: 'Asia/Vladivostok' },
        { label: '(GMT+11:00) Magadan, Solomon Is., New Caledonia', value: 'Asia/Magadan' },
        { label: '(GMT+12:00) Auckland, Wellington', value: 'Pacific/Auckland' },
        { label: '(GMT+12:00) Fiji, Kamchatka, Marshall Is.', value: 'Pacific/Fiji' },
        { label: '(GMT+13:00) Nuku\'alofa', value: 'Pacific/Tongatapu' }
      ]
    }
  },
  computed: {
    targetTz: {
      get () {
        return this.$cookies.get('timezone', { parseJSON: true })?.target || ''
      },
      set (value) {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
        this.$cookies.set('timezone', JSON.stringify({
          target: value,
          browser: browserTz
        }), { maxAge: 2147483646 })
        this.$emit('fetch')
      }
    }
  },
  mounted () {
    if (!this.targetTz) {
      this.targetTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }
}
</script>

<style>

</style>
