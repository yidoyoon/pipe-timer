import requireAuth from 'src/router/middleware/requireAuth';
import { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () =>
      import('../core/common/presentation/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        component: () =>
          import('../core/common/presentation/page/IndexPage.vue'),
        name: 'index',
      },
      {
        path: 'guide',
        component: () => import('../core/guide/presentation/AppGuide.vue'),
        name: 'guide',
      },
      {
        path: 'login',
        component: () => import('../core/users/presentation/UserLogin.vue'),
        name: 'login',
      },
      {
        path: 'signup',
        component: () => import('../core/users/presentation/UserSignup.vue'),
        name: 'signup',
      },
      {
        path: 'editor',
        component: () =>
          import('../core/common/presentation/page/EditorMain.vue'),
        name: 'editor',
        // meta: {
        //   middleware: [requireAuth],
        // },
      },
    ],
  },
  {
    path: '/user',
    children: [
      {
        path: 'verify-email',
        component: () =>
          import('../core/users/presentation/UserSignupVerify.vue'),
        name: 'verify-email',
      },
    ],
  },
  // TODO: Slot 활용하여 컴포넌트 재사용률 높이기(https://router.vuejs.org/guide/essentials/named-views.html#nested-named-views)
  {
    path: '/pomodoro',
    component: () =>
      import('../core/common/presentation/layouts/PomoLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('../core/pomodoro/presentation/PomodoroMain.vue'),
        name: 'pomodoro',
      },
    ],
  },
  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () =>
      import('../core/common/presentation/page/ErrorNotFound.vue'),
    name: 'error',
  },
];

export default routes;
