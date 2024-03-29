<template>
  <div class="q-pa-md absolute-center" style="min-width: 400px">
    <div class="text-h4 q-mb-lg">Login</div>
    <q-form
      @submit.prevent="onSubmit"
      class="q-gutter-sm"
      autocorrect="off"
      autocapitalize="off"
      autocomplete="off"
      spellcheck="false"
    >
      <q-input
        filled
        v-model="email"
        label="Email"
        placeholder="account@example.com"
        :error-message="emailError"
        :error="!!emailError"
        debounce="1000"
      />
      <q-input
        filled
        v-model="password"
        label="Password"
        :type="isPwd ? 'password' : 'text'"
        placeholder="8 - 32 characters"
        :error-message="passwordError"
        :error="!!passwordError"
        debounce="1000"
      >
        <template v-slot:append>
          <q-icon
            :name="isPwd ? 'visibility_off' : 'visibility'"
            class="cursor-pointer"
            @click="isPwd = !isPwd"
          />
        </template>
      </q-input>

      <div class="row">
        <q-btn label="login" type="submit" color="primary" />
        <q-space />
        <q-btn label="cancel" to="/" flat class="q-ml-sm" />
      </div>
      <div class="text-body2">
        계정이 없다면 회원가입 해주세요.
        <a class="cursor-pointer" @click="router.push({ name: 'check-email' })"
          ><b>회원가입</b></a
        >
      </div>
    </q-form>
  </div>
</template>

<script setup lang="ts">
import { useMutation } from '@tanstack/vue-query';
import { toTypedSchema } from '@vee-validate/zod';
import axios, { AxiosError } from 'axios';
import { useQuasar } from 'quasar';
import { usePanelStore } from 'src/core/panel/infra/store/panel.store';
import { useRoutineStore } from 'src/core/routines/infra/store/routine.store';
import { useTimerStore } from 'src/core/timers/infra/store/timer.store';
import { CHECK_EMPTY, userMsg } from 'src/core/users/domain/user.const';
import { getMeFn, loginUserFn } from 'src/core/users/infra/http/user.api';
import { useUserStore } from 'src/core/users/infra/store/user.store';
import { ILoginInput } from 'src/type-defs/userTypes';
import { useSocketStore } from 'stores/socket.store';
import { useField, useForm } from 'vee-validate';
import { onBeforeMount, onBeforeUpdate, ref } from 'vue';
import { useRouter } from 'vue-router';
import * as zod from 'zod';

const $q = useQuasar();
const isPwd = ref(true);
const router = useRouter();

const userStore = useUserStore();
const routineStore = useRoutineStore();
const panelStore = usePanelStore();
const timerStore = useTimerStore();
const socketStore = useSocketStore();

onBeforeMount(() => {
  routineStore.bottomDrawerHeight = 36;
});

const loginSchema = toTypedSchema(
  zod.object({
    email: zod
      .string()
      .min(1, userMsg.EMPTY_USER_EMAIL)
      .email(userMsg.INVALID_USER_EMAIL),
    password: zod.string().min(CHECK_EMPTY, userMsg.EMPTY_USER_PASSWORD),
  })
);

const { handleSubmit, resetForm } = useForm({
  validationSchema: loginSchema,
});

const { value: email, errorMessage: emailError, setErrors } = useField('email');
const { value: password, errorMessage: passwordError } = useField('password');

const { mutate } = useMutation(
  (credentials: ILoginInput) => loginUserFn(credentials),
  {
    onError: (error: AxiosError) => {
      if (axios.isAxiosError(error) && error.response) {
        const errMsg = error.response.data.message as string;
        if (
          errMsg === 'Incorrect email or password' ||
          errMsg === 'No matching account information'
        ) {
          setErrors('이메일 혹은 비밀번호가 일치하지 않습니다.');
        }
      }
    },
    onSuccess: async () => {
      panelStore.$reset();
      timerStore.$reset();
      routineStore.$reset();

      socketStore.disconnect();
      socketStore.initSocket();

      const response = await getMeFn();
      userStore.setUser({ ...response });

      await router.push({ name: 'panel' });

      await timerStore.fetchAll();
      await routineStore.fetchAll();
    },
  }
);

const onSubmit = handleSubmit((values) => {
  mutate({
    email: values.email,
    password: values.password,
  });

  resetForm();
});

onBeforeUpdate(() => {});
</script>
