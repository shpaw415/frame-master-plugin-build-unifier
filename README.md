# build-unifier

Frame-Master plugin

## Installation

```bash
bun add build-unifier
```

## Usage

```typescript
import type { FrameMasterConfig } from "frame-master/server/types";
import buildunifier from "build-unifier";

const config: FrameMasterConfig = {
  HTTPServer: { port: 3000 },
  plugins: [buildunifier()],
};

export default config;
```

## Features

- Feature 1
- Feature 2

## License

MIT

```

```
