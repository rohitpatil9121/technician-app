import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Give Tailwind an ABSOLUTE config path so it finds tailwind.config.js even when
// the dev server is launched from a parent directory (process cwd != this folder).
const here = dirname(fileURLToPath(import.meta.url));

export default { plugins: [tailwindcss(join(here, "tailwind.config.js")), autoprefixer] };
