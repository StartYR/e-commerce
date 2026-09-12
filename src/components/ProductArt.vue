<script setup>
defineProps({ kind: { type: String, required: true }, color: { type: String, default: '#81907b' } })
</script>

<template>
  <svg class="product-art" viewBox="0 0 320 260" fill="none" aria-hidden="true">
    <g class="art-shadow">
      <g v-if="kind === 'notebook'" transform="rotate(-12 160 130)">
        <rect x="94" y="40" width="139" height="184" rx="5" fill="#d6d0bc" />
        <rect x="93" y="36" width="137" height="182" rx="4" fill="#f5f0e0" />
        <path d="M104 209h124m-124 3h124" stroke="#d9d0ba" />
        <rect x="87" y="31" width="143" height="176" rx="5" :fill="color" />
        <path d="M100 32v174" stroke="#fff" stroke-opacity=".22" />
        <path d="M106 33v172" stroke="#203d26" stroke-opacity=".08" />
        <rect x="114" y="76" width="91" height="68" rx="1" fill="#f4efdf" />
        <text x="159" y="101" text-anchor="middle" fill="#576047" font-size="9" font-family="Georgia, serif" letter-spacing="2">FIELD NOTES</text>
        <path d="M144 114h30m-22 6h14" stroke="#a5a78c" />
        <text x="159" y="134" text-anchor="middle" fill="#8e927b" font-size="5" letter-spacing="1.7">MAKE ROOM FOR IDEAS</text>
        <path d="M216 32v175" stroke="#3c5038" stroke-width="4" stroke-opacity=".6" />
        <path d="M202 219v16l6-5 6 5v-16" fill="#d1b582" />
      </g>
      <g v-else-if="kind === 'spiral'" transform="rotate(10 160 130)">
        <rect x="88" y="37" width="145" height="187" rx="4" fill="#dbd3c0" />
        <rect x="87" y="33" width="144" height="186" rx="4" fill="#f7f3e6" />
        <rect x="86" y="29" width="144" height="181" rx="4" :fill="color" />
        <path d="M108 29v181" stroke="#a08a66" stroke-opacity=".4" />
        <g v-for="index in 10" :key="index">
          <circle cx="99" :cy="38 + index * 15" r="3" fill="#7b6c53" />
          <path :d="`M99 ${38 + index * 15}c-23 5-23-13 0-10`" stroke="#807d6e" stroke-width="3" stroke-linecap="round" />
        </g>
        <rect x="128" y="78" width="75" height="71" fill="#f7f2df" />
        <text x="165" y="99" fill="#87785c" font-family="Georgia, serif" font-size="10" text-anchor="middle">a little space</text>
        <text x="165" y="114" fill="#87785c" font-family="Georgia, serif" font-size="10" text-anchor="middle">for big ideas.</text>
        <path d="M145 130h39m-34 5h29" stroke="#bcb398" />
      </g>
      <g v-else-if="kind === 'pens'" transform="rotate(28 160 130)">
        <g v-for="(penColor, index) in [color, '#e2d9c6']" :key="penColor" :transform="`translate(${index * 40} ${index * -12})`">
          <rect x="128" y="41" width="15" height="166" rx="6" :fill="penColor" />
          <path d="m128 192 7.5 27 7.5-27" fill="#d3cfc2" />
          <path d="m133 213 2.5 9 2.5-9" fill="#59584f" />
          <rect x="128" y="48" width="15" height="55" rx="4" :fill="penColor" />
          <path d="M131 47v48" stroke="#fff" stroke-opacity=".4" stroke-width="2" />
          <path d="M144 51v36q0 6-5 6" stroke="#7f8174" stroke-width="3" />
          <rect x="132" y="33" width="7" height="11" rx="2" fill="#aaa997" />
          <path d="M130 111h11" stroke="#757866" stroke-opacity=".4" />
        </g>
      </g>
      <g v-else-if="kind === 'pouch'" transform="rotate(-9 160 130)">
        <path d="M56 103q0-13 15-15h183q14 2 12 17l-9 83q-2 12-14 12H70q-14-2-15-15Z" :fill="color" />
        <path d="M57 103h207l-3 12H57Z" fill="#9c977d" />
        <path d="M64 108h191" stroke="#dedac6" stroke-width="3" stroke-dasharray="2 2" />
        <path d="M64 124v58q0 9 9 9h168q8 0 9-9l7-58" stroke="#a99f83" stroke-dasharray="3 3" />
        <rect x="133" y="139" width="61" height="31" fill="#e9e4d3" />
        <text x="163" y="157" text-anchor="middle" fill="#727962" font-family="Georgia, serif" font-size="11" letter-spacing="2">SHIYE</text>
        <rect x="253" y="103" width="19" height="7" rx="3" fill="#d1b480" />
        <path d="m269 105 13 15" stroke="#a18b64" stroke-width="4" stroke-linecap="round" />
      </g>
      <g v-else-if="kind === 'highlighters'" transform="rotate(-24 160 130)">
        <g v-for="(penColor, index) in ['#e2b3a0', '#b6c2a3', '#dcc28f']" :key="penColor" :transform="`translate(${index * 38} ${index === 1 ? -15 : 0})`">
          <rect x="108" y="63" width="25" height="141" rx="6" :fill="penColor" />
          <path d="M111 81v40" stroke="#fff" stroke-opacity=".4" stroke-width="2" />
          <path d="M109 112h23m-23 57h23" stroke="#777568" stroke-opacity=".3" />
          <rect x="115" y="56" width="12" height="12" rx="3" :fill="penColor" />
          <text transform="rotate(90 121 132)" x="121" y="132" fill="#5b6254" font-family="sans-serif" font-size="5" letter-spacing="1">SOFT LIGHT</text>
        </g>
      </g>
      <g v-else-if="kind === 'pencils'" transform="rotate(30 160 130)">
        <g v-for="index in 3" :key="index" :transform="`translate(${index * 27} ${index === 2 ? -12 : 0})`">
          <path d="M99 57h12v141l-6 23-6-23Z" :fill="color" />
          <path d="M99 57h4v141h-4Z" fill="#e5c591" />
          <path d="m99 198 6 23 6-23" fill="#f0d8ac" />
          <path d="m102 211 3 10 3-10" fill="#4c4b44" />
          <rect x="99" y="47" width="12" height="18" rx="2" fill="#8d9a82" />
          <rect x="99" y="63" width="12" height="7" fill="#c5bea8" />
          <text transform="rotate(90 106 113)" x="106" y="113" fill="#857048" font-size="5" letter-spacing="1">NATURAL · HB</text>
        </g>
      </g>
      <g v-else-if="kind === 'tape'">
        <g v-for="(tapeColor, index) in ['#bdc5ac', '#d4b99a', '#7e9279']" :key="tapeColor" :transform="`translate(${[0, 71, 29][index]} ${[11, 42, -31][index]})`">
          <path d="M89 125v36c0 20 94 20 94 0v-36" :fill="tapeColor" />
          <ellipse cx="136" cy="125" rx="47" ry="19" :fill="tapeColor" />
          <ellipse cx="136" cy="125" rx="29" ry="11" fill="#e1d7be" />
          <ellipse cx="136" cy="127" rx="24" ry="8" fill="#f0ede2" />
          <path v-if="index === 0" d="M94 141h84m-84 9h84m-73-15v26m14-23v26m14-24v26m14-26v26m14-28v24" stroke="#eff0e1" stroke-opacity=".6" stroke-width="2" />
          <path v-else d="m107 149 7 5-2-11m15 10 7 5-2-11m15 6 7 4-2-11m15 4 7 2-2-9" stroke="#f2efdc" stroke-opacity=".7" stroke-width="2" />
        </g>
      </g>
      <g v-else-if="kind === 'planner'" transform="rotate(-9 160 130)">
        <rect x="52" y="68" width="218" height="137" rx="3" fill="#c8bda6" />
        <rect x="50" y="62" width="218" height="137" rx="3" fill="#fbf7e9" />
        <rect x="50" y="62" width="218" height="23" :fill="color" />
        <text x="64" y="78" fill="#655e4e" font-size="8" font-family="Georgia, serif" letter-spacing="2">ONE WEEK AT A TIME</text>
        <path d="M63 101h192m-192 25h192m-192 25h192m-192 25h192M111 94v93m48-93v93m48-93v93" stroke="#ddd6be" />
        <path d="m76 113 4 3 6-8m41 30h15m35 24 5 3 6-8" stroke="#9da789" stroke-width="2" stroke-linecap="round" />
        <circle cx="231" cy="112" r="5" fill="#d7b598" fill-opacity=".5" />
      </g>
      <g v-else-if="kind === 'clips'">
        <g v-for="(clipColor, index) in ['#a9b59d', '#d4bba1', '#e3d8b7', '#7c8a77']" :key="clipColor" :transform="`translate(${[0, 83, 14, 97][index]} ${[0, 12, 86, 98][index]}) rotate(${[-18, 16, 12, -20][index]} 104 83)`">
          <path d="m80 69 6 35h38l6-35Z" :fill="clipColor" />
          <rect x="77" y="67" width="56" height="7" rx="2" :fill="clipColor" />
          <path d="M92 76V50q0-14 12-14h3q12 0 12 14v26M92 87v20q0 15 13 15t14-15V87" stroke="#a79876" stroke-width="3" />
        </g>
      </g>
      <g v-else-if="kind === 'tray'" transform="rotate(-12 160 130)">
        <rect x="54" y="71" width="218" height="137" rx="30" fill="#c8bfaa" />
        <rect x="49" y="61" width="218" height="137" rx="29" fill="#e1dac7" />
        <rect x="62" y="74" width="192" height="110" rx="22" :fill="color" />
        <path d="M68 161V98q0-17 18-18h145q14 0 16 15" stroke="#aaa18d" stroke-opacity=".5" stroke-width="3" />
        <rect x="93" y="93" width="60" height="72" rx="2" fill="#ece6d5" transform="rotate(7 123 129)" />
        <path d="M174 91v65" stroke="#70846e" stroke-width="9" stroke-linecap="round" />
        <path d="m174 156 0 10" stroke="#7a7360" stroke-width="3" />
        <path d="M202 112v26q0 12 8 12t8-12v-32q0-8-6-8t-6 8v28" stroke="#a59365" stroke-width="3" />
      </g>
      <g v-else-if="kind === 'notes'">
        <g v-for="(noteColor, index) in ['#d8c897', '#9eae98', '#d8b59f']" :key="noteColor" :transform="`translate(${[0, 81, 42][index]} ${[0, -8, 55][index]}) rotate(${[-13, 9, -3][index]} 120 111)`">
          <rect x="67" y="57" width="111" height="105" rx="2" fill="#d7cfb8" />
          <rect x="67" y="52" width="111" height="105" rx="2" :fill="noteColor" />
          <path d="M67 74h111" stroke="#fff" stroke-opacity=".18" />
          <path d="m152 157 26-25v25Z" fill="#f4ead0" fill-opacity=".55" />
        </g>
      </g>
      <g v-else-if="kind === 'tote'" transform="rotate(9 160 130)">
        <path d="M123 88V60q0-35 37-35t37 35v28" stroke="#bcb396" stroke-width="13" />
        <path d="M122 88V60q0-35 37-35t37 35v28" stroke="#ded5bb" stroke-width="8" />
        <path d="M83 80h156l-5 140q-76 10-146 0Z" fill="#e2dac3" />
        <path d="M93 86v126q66 10 131 0l6-126M118 81v28m81-28v28" stroke="#b9af94" stroke-dasharray="3 3" />
        <path d="M155 174c-26-39 18-65 33-54 15 16-19 39-29 48m0 16v-44" stroke="#7d8f71" stroke-width="2" />
        <text x="162" y="198" fill="#77856b" text-anchor="middle" font-family="Georgia, serif" font-size="9" letter-spacing="3">SLOW DAYS</text>
      </g>
    </g>
  </svg>
</template>
