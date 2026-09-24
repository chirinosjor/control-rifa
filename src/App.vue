<template>
  <div>
    <h1>Control Rifa Navidad 2026</h1>

    <!-- Hidden iframe for invisible submission -->
    <iframe name="submitFrame" style="display: none"></iframe>

    <!-- Hidden form targeting the iframe -->
    <form :action="scriptUrl" method="POST" target="submitFrame" ref="formRef">
      <input type="hidden" name="sheetName" v-model="selectedSheet" />
      <input type="hidden" name="dateOfPayment" v-model="dateOfPayment" />
      <input type="hidden" name="reference" v-model="reference" />
      <input type="hidden" name="quantity" v-model="quantity" />
      <input type="hidden" name="amount" v-model="amount" />
    </form>

    <!-- Visible Vue inputs -->
    <div class="form-container">
      <div class="input-group">
        <label for="sheetName">Nombre:</label>
        <select
          id="sheetName"
          v-model="selectedSheet"
          required
          :disabled="sheetOptionsLoading"
          @blur="selectedSheetTouched = true"
        >
          <option value="" disabled>
            {{ sheetOptionsLoading ? 'Cargando...' : 'Selecciona un nombre' }}
          </option>
          <option v-for="name in sheetOptions" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
        <span class="error" v-if="selectedSheetError">{{ selectedSheetError }}</span>
        <span class="error" v-if="sheetOptionsError">
          {{ sheetOptionsError }}
          <button type="button" class="retry-link" @click="loadSheetOptions">Reintentar</button>
        </span>
      </div>

      <div class="input-group">
        <label for="dateOfPayment">Fecha del pago (DD/MM):</label>
        <input
          id="dateOfPayment"
          :value="dateInput"
          type="text"
          placeholder="DD/MM"
          required
          @input="onDateInput"
          @blur="dateTouched = true"
        />
        <span class="error" v-if="dateError">{{ dateError }}</span>
      </div>

      <div class="input-group">
        <label for="reference">Referencia:</label>
        <input
          id="reference"
          :value="reference"
          type="text"
          inputmode="numeric"
          placeholder="0000"
          @input="onReferenceInput"
        />
      </div>

      <div class="input-group">
        <label for="amount">Monto:</label>
        <input
          id="amount"
          :value="amountDisplay"
          type="text"
          inputmode="decimal"
          placeholder="ej. 1200,22"
          required
          @input="onAmountInput"
          @blur="amountTouched = true"
        />
        <span class="error" v-if="amountError">{{ amountError }}</span>
      </div>

      <div class="input-group">
        <label for="quantity">Cantidad de números:</label>
        <input
          id="quantity"
          :value="quantityDisplay"
          type="text"
          inputmode="decimal"
          placeholder="ej. 3,5"
          required
          @input="onQuantityInput"
          @blur="quantityTouched = true"
        />
        <span class="error" v-if="quantityError">{{ quantityError }}</span>
      </div>

      <button @click="submitForm" :disabled="!isFormValid">Enviar</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const selectedSheet = ref('')
const dateOfPayment = ref('')
const dateInput = ref('')
const reference = ref('')
const quantity = ref(0)
const amount = ref(0)

const sheetOptions = ref<string[]>([])
const sheetOptionsLoading = ref(true)
const sheetOptionsError = ref('')

const selectedSheetTouched = ref(false)
const dateTouched = ref(false)
const amountTouched = ref(false)
const quantityTouched = ref(false)

// Your deployed Apps Script URL
const scriptUrl =
  'https://script.google.com/macros/s/AKfycbzT9McBHM4taImiQHAFZKrEkjoGewqKrLIGu8NYBFoemsl84CKPfclrNXBwZBQfctRN/exec'
const formRef = ref<HTMLFormElement>()

// Apps Script doesn't send CORS headers on doGet, so a plain fetch() gets
// blocked by the browser. We load the sheet list via JSONP instead: a
// <script> tag isn't subject to CORS. Timeout is generous (25s) because
// some users are on slow/high-latency connections to script.google.com.
function fetchSheetNamesJsonp(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const callbackName = `sheetNamesCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('Tiempo de espera agotado'))
    }, 25000)

    const cleanup = () => {
      clearTimeout(timeoutId)
      delete (window as unknown as Record<string, unknown>)[callbackName]
      script.remove()
    }

    ;(window as unknown as Record<string, unknown>)[callbackName] = (data: {
      result: string
      sheets?: string[]
    }) => {
      cleanup()
      if (data.result === 'success' && Array.isArray(data.sheets)) {
        resolve(data.sheets)
      } else {
        reject(new Error('Respuesta inválida'))
      }
    }

    script.src = `${scriptUrl}?callback=${callbackName}`
    script.onerror = () => {
      cleanup()
      reject(new Error('No se pudo cargar el script'))
    }
    document.body.appendChild(script)
  })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function loadSheetOptions() {
  sheetOptionsLoading.value = true
  sheetOptionsError.value = ''

  const attempts = 3
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      sheetOptions.value = await fetchSheetNamesJsonp()
      sheetOptionsLoading.value = false
      return
    } catch {
      if (attempt < attempts) await sleep(1500)
    }
  }

  sheetOptionsError.value = 'No se pudo cargar la lista de nombres'
  sheetOptionsLoading.value = false
}

onMounted(loadSheetOptions)

// Masked inputs force the cleaned value back onto the DOM element directly
// (instead of relying on v-model's reactive diffing): if noisy input happens
// to clean up to the same underlying value already stored (e.g. typing
// "3a,,5b6c" when the field already holds 3,5), Vue sees no change and skips
// re-rendering, leaving the raw uncleaned text stuck on screen.
function cleanDate(raw: string): string {
  let cleaned = raw.replace(/\D/g, '').slice(0, 4)
  if (cleaned.length >= 2) {
    cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2)
  }
  return cleaned
}
function onDateInput(event: Event) {
  const target = event.target as HTMLInputElement
  const cleaned = cleanDate(target.value)
  dateInput.value = cleaned
  target.value = cleaned
}

function cleanReference(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4)
}
function onReferenceInput(event: Event) {
  const target = event.target as HTMLInputElement
  const cleaned = cleanReference(target.value)
  reference.value = cleaned
  target.value = cleaned
}

// No forced decimals while the field is untouched/reset: showing a fake
// ",00" would inject extra digit characters that the next keystroke's
// digit filter would sweep up, corrupting the number (typing "1" then "2"
// would read back "1002" instead of "12"). Once the user types a comma,
// the real decimal digits they typed are shown as-is (up to 2), so no
// fake digits are ever introduced. The sheet's cell format still forces
// the final accounting-style ",00" display.
const amountDisplay = computed(() =>
  amount.value === 0 ? '' : amount.value.toLocaleString('es-CL', { maximumFractionDigits: 2 }),
)
function onAmountInput(event: Event) {
  const target = event.target as HTMLInputElement
  const cleaned = target.value.replace(/[^\d,]/g, '')
  const commaIndex = cleaned.indexOf(',')
  const intPart = commaIndex === -1 ? cleaned : cleaned.slice(0, commaIndex)
  const decPart = commaIndex === -1 ? '' : cleaned.slice(commaIndex + 1).replace(/,/g, '').slice(0, 2)

  amount.value =
    intPart === '' && decPart === '' ? 0 : parseFloat(`${intPart || '0'}.${decPart || '0'}`)

  const groupedInt =
    intPart === '' ? (commaIndex !== -1 ? '0' : '') : parseInt(intPart, 10).toLocaleString('es-CL')
  target.value = commaIndex !== -1 ? `${groupedInt},${decPart}` : groupedInt
}

function cleanQuantity(raw: string): string {
  let cleaned = raw.replace(/[^\d,]/g, '')
  const commaIndex = cleaned.indexOf(',')
  if (commaIndex !== -1) {
    cleaned =
      cleaned.slice(0, commaIndex + 1) + cleaned.slice(commaIndex + 1).replace(/,/g, '').slice(0, 1)
  }
  return cleaned
}
const quantityDisplay = computed(() => (quantity.value === 0 ? '' : String(quantity.value).replace('.', ',')))
function onQuantityInput(event: Event) {
  const target = event.target as HTMLInputElement
  const cleaned = cleanQuantity(target.value)
  quantity.value = cleaned === '' || cleaned === ',' ? 0 : parseFloat(cleaned.replace(',', '.'))
  target.value = cleaned
}

const selectedSheetError = computed(() =>
  !selectedSheetTouched.value ? '' : selectedSheet.value === '' ? 'Selecciona un nombre' : '',
)
const dateError = computed(() => {
  if (!dateTouched.value) return ''
  const dateRegex = /^\d{2}\/\d{2}$/
  if (!dateRegex.test(dateInput.value)) return 'Formato inválido (DD/MM)'
  const parts = dateInput.value.split('/')
  const day = parseInt(parts[0] ?? '', 10)
  const month = parseInt(parts[1] ?? '', 10)
  if (day < 1 || day > 31 || month < 1 || month > 12) return 'Fecha inválida'
  return ''
})
const amountError = computed(() =>
  !amountTouched.value ? '' : amount.value <= 0 ? 'Monto debe ser mayor a 0' : '',
)
const quantityError = computed(() =>
  !quantityTouched.value ? '' : quantity.value <= 0 ? 'Cantidad debe ser mayor a 0' : '',
)

const isFormValid = computed(() => {
  if (selectedSheet.value === '' || amount.value <= 0 || quantity.value <= 0) return false

  const dateRegex = /^\d{2}\/\d{2}$/
  if (!dateRegex.test(dateInput.value)) return false
  const [dayStr, monthStr] = dateInput.value.split('/')
  const day = parseInt(dayStr ?? '', 10)
  const month = parseInt(monthStr ?? '', 10)
  if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) return false

  return true
})

const submitForm = () => {
  // Set full date with current year before submission
  const parts = dateInput.value.split('/')
  if (parts.length === 2) {
    const [dayRaw, monthRaw] = parts
    const day = dayRaw?.padStart(2, '0')
    const month = monthRaw?.padStart(2, '0')
    dateOfPayment.value = `2026-${month}-${day}`

    // Update the hidden input manually
    const dateInputEl = formRef.value?.querySelector<HTMLInputElement>(
      "input[name='dateOfPayment']",
    )
    if (dateInputEl) dateInputEl.value = dateOfPayment.value
  }

  console.log('Submitting form with date:', dateOfPayment.value)
  formRef.value?.submit()
  alert('Datos enviados correctamente!')

  // Reset form (keep selectedSheet so multiple payments for the same person are quick to log)
  dateInput.value = ''
  dateOfPayment.value = ''
  reference.value = ''
  amount.value = 0
  quantity.value = 0

  // Reset touched states
  dateTouched.value = false
  amountTouched.value = false
  quantityTouched.value = false
}
</script>

<style scoped>
/* Enhanced styling for mobile web app */
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  margin: 0;
  padding: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

div {
  margin: 0 auto;
  padding: 0.5rem;
  max-width: 320px;
  width: auto;
}

h1 {
  text-align: center;
  margin-bottom: 2rem;
  font-size: 1.8rem;
  color: #333;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.form-container {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 0; /* Override previous */
}

label {
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: #555;
}

input,
select {
  padding: 1rem 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  box-sizing: border-box;
  width: 100%;
  transition: all 0.3s ease;
  background: #f8f9fa;
}

input:focus,
select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  background: white;
}

.error {
  color: #dc3545;
  font-size: 0.8rem;
  margin-top: 0.25rem;
  display: block;
  font-weight: 500;
}

.retry-link {
  background: none;
  border: none;
  padding: 0;
  margin-left: 0.25rem;
  color: #667eea;
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  box-shadow: none;
}

button {
  padding: 0.875rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  margin-top: 1rem;
  align-self: center;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

@media (min-width: 768px) {
  form {
    gap: 2rem;
  }
  h1 {
    font-size: 2.2rem;
  }
  .form-container {
    padding: 2.5rem;
  }
  div {
    max-width: 400px;
  }
}

@media (max-width: 480px) {
  div {
    padding: 0.5rem;
  }
  .form-container {
    padding: 1.5rem;
    border-radius: 8px;
  }
  input,
  select {
    padding: 0.875rem 0.625rem;
    font-size: 0.95rem;
  }
  button {
    width: 100%;
    padding: 0.875rem;
  }
  h1 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }
}

@media (max-width: 375px) {
  div {
    padding: 0.5rem;
    max-width: 280px;
  }
  .form-container {
    padding: 1rem;
    border-radius: 6px;
  }
  input,
  select {
    padding: 0.75rem 0.5rem;
    font-size: 0.9rem;
  }
  label {
    font-size: 0.8rem;
  }
  button {
    padding: 0.75rem;
    font-size: 0.95rem;
  }
  h1 {
    font-size: 1.4rem;
    margin-bottom: 1rem;
  }
  form {
    gap: 1rem;
  }
}

@media (max-width: 320px) {
  .form-container {
    padding: 0.75rem;
    margin: 0.5rem;
  }
  input,
  select {
    padding: 0.75rem 0.5rem;
    font-size: 0.85rem;
    border-radius: 6px;
  }
  label {
    font-size: 0.8rem;
    margin-bottom: 0.25rem;
  }
  button {
    padding: 0.625rem;
    font-size: 0.9rem;
    border-radius: 6px;
  }
  h1 {
    font-size: 1.2rem;
    margin-bottom: 0.75rem;
  }
  .error {
    font-size: 0.75rem;
  }
  form {
    gap: 1rem;
  }
  div {
    padding: 0.25rem;
  }
}
</style>
