import { initFirebase } from "./modulos/firebase/config.js";
import { signInWithGoogle } from "./modulos/firebase/auth.js";
import { guardGuestPage, redirectToHomeByRole } from "./modulos/js/app/guards.js";
import { createLoginModule } from "./modulos/login/login.module.js";

const loginApp = createLoginModule({
	init: initFirebase,
	guardGuestPage: () => guardGuestPage({ homePath: "./juegos/index.html" }),
	onEmailLogin: ({ email, password }) => signIn(email, password),
	onGoogleLogin: () => signInWithGoogle(),
	onPasswordReset: (email) => requestPasswordReset(email),
	redirect: () => redirectToHomeByRole("./juegos/index.html")
});

loginApp.bootstrap();