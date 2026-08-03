<script setup lang="ts">
import { onMounted, ref } from 'vue'

const enabled = ref(true)
const statusMessage = ref('Ready to help with your videos.')

onMounted(() => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    statusMessage.value = 'Running outside the Chrome extension.'
    return
  }

  chrome.storage.local.get({ enabled: true }, ({ enabled: storedEnabled }) => {
    enabled.value = storedEnabled
  })
})

function updateEnabled() {
  statusMessage.value = enabled.value ? 'TubeMaster is enabled.' : 'TubeMaster is paused.'

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.set({ enabled: enabled.value })
  }
}
</script>

<template>
  <v-app>
    <v-main class="popup-main">
      <v-card class="popup-card" flat>
        <v-card-item>
          <template #prepend>
            <v-avatar color="primary" variant="tonal">
              <v-icon icon="mdi-play-circle-outline" />
            </v-avatar>
          </template>
          <v-card-title>TubeMaster</v-card-title>
          <v-card-subtitle>Video companion</v-card-subtitle>
        </v-card-item>

        <v-card-text class="pt-2">
          <v-switch
            v-model="enabled"
            color="primary"
            hide-details
            inset
            label="Enable TubeMaster"
            @update:model-value="updateEnabled"
          />
          <p class="status-message">{{ statusMessage }}</p>
        </v-card-text>

        <v-card-actions>
          <v-btn
            block
            color="primary"
            prepend-icon="mdi-cog-outline"
            variant="tonal"
          >
            Settings
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-main>
  </v-app>
</template>

<style scoped>
.popup-main {
  min-width: 360px;
}

.popup-card {
  border-radius: 0;
}

.status-message {
  color: rgba(var(--v-theme-on-surface), 0.65);
  font-size: 0.875rem;
  margin: 16px 0 0;
}
</style>
