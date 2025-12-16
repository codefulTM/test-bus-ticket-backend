# Unit Tests — Auth & Admin (Service + Controller)

This document explains how the unit tests are implemented for the auth and admin modules (service + controller) in this project, and shows how to produce simple test reports with Jest. It focuses only on:

- `AuthService` (unit tests)
- `AuthController` (unit tests)
- `AdminService` (unit tests)
- `AdminController` (unit tests)

## Overview

Unit tests are written using Jest and Nest's `TestingModule` helpers. Tests avoid integration dependencies: TypeORM repositories, Redis and other external services are mocked. Tests are written to follow strong TypeScript typing to satisfy `@typescript-eslint` rules.

Goals:

- Verify logic inside services (happy path + error cases)
- Verify controllers correctly call services, set cookies/headers, and return expected shapes
- Keep tests fast and deterministic

## Test structure & locations

Conventions used in this repo:

```
src/
  auth/
    auth.service.ts
    auth.controller.ts
    auth.service.spec.ts
    auth.controller.spec.ts
  admin/
    admin.service.ts
    admin.controller.ts
    admin.service.spec.ts
    admin.controller.spec.ts
test/
  utils/
    repository.mock.ts   # typed helpers (optional)
    redis.mock.ts        # typed redis mock
```

Each `*.spec.ts` is a unit test file for a single class.

## Test patterns used

### Dependency injection & typed repository mocks

We avoid touching the real database by mocking the repository object that Nest injects via `getRepositoryToken(Entity)`. Example pattern:

```ts
// typed repo mock for User repository
type RepoFindOneFn<T> = jest.Mock<Promise<T | null>, [Record<string, unknown>]>;
type RepoSaveFn<T> = jest.Mock<Promise<T>, [Partial<T>]>;

const userRepoMock = {
  findOne: jest.fn<Promise<User | null>, [Record<string, unknown>]>(() => Promise.resolve(null)),
  save: jest.fn<Promise<User>, [Partial<User>]>(p => Promise.resolve(p as User)),
};
```

Provide it to the test module:

```ts

const module = await Test.createTestingModule({
  providers: [
    AuthService,
    { provide: getRepositoryToken(User), useValue: userRepoMock },
    // ...
  ],
}).compile();
```

This keeps the types strict and prevents ESLint `no-unsafe-*` complaints.

### Jest mocks for external libs

- `bcrypt` — mock `compare` and `hash` via `jest.fn()` or `jest.mock('bcrypt', ...)`.
- `JwtService` — provide a small object with `sign`, `verify`, `decode` mocks (typed as `Partial<JwtService>`).
- `Redis` — use a typed helper `createRedisMock()` that returns typed `get`, `set`, etc.

### Controller tests

Controller tests call controller methods directly and assert:

- service method called with expected args (`toHaveBeenCalledWith`)
- cookies set via `res.cookie` and cleared via `res.clearCookie`
- redirects performed via `res.redirect`
- returned JSON shape matches expected result

Example `res` mock:

```ts
const res: Partial<Response> = {
  cookie: jest.fn(),
  redirect: jest.fn(),
  clearCookie: jest.fn(),
};
```

## Example test anatomy

### AuthService (happy path)

- Arrange: mock `userRepo.findOne` to return a user fixture.
- Act: `await service.login(loginDto)`
- Assert: response includes `accessToken`, `refreshToken`, `user` and `JwtService.sign` called.

AuthController (login)

- Arrange: `authService.login` returns shaped response.
- Act: `await controller.login(dto, res as Response)`
- Assert:
  - `authService.login` called with `dto`
  - `res.cookie` called for `access_token` and `refresh_token`
  - returned object contains `data.user`

## Running tests locally

Basic commands (uses Jest configured in `package.json`):

```bash
# run all tests
$ npm test

# run a single file
$ npx jest src/auth/auth.service.spec.ts -i

# run with verbose output
$ npx jest --verbose

# run and watch
$ npm run test:watch
```

## Coverage and reporters

### Coverage (HTML)

```bash
npx jest --coverage
```

Open `coverage/lcov-report/index.html` to view the HTML coverage report.

Add npm script:

```json
"scripts": {
  "test": "jest --runInBand",
  "test:coverage": "jest --coverage"
}
```

### JSON / JUnit reporters (for CI)

Install `jest-junit` if desired:

```bash
npm install --save-dev jest-junit
```

Add to `jest.config.js` or `package.json`:

```json
"jest": {
  "reporters": [
    "default",
    ["jest-junit", { "outputDirectory": "reports/junit", "outputName": "junit.xml" }]
  ]
}
```

Or run:

```bash
npx jest --json --outputFile=reports/results.json
```

## Simple test report example

Minimal bash script to run tests and generate reports:

```bash
#!/usr/bin/env bash
set -e
npm test --silent
npx jest --coverage --color=false > reports/jest-run.txt
npx jest --json --outputFile=reports/results.json
echo "Tests finished. Summary:"
jq '.numTotalTests, .numPassedTests, .numFailedTests, .numPendingTests' reports/results.json
```

`reports/jest-run.txt` contains console output; `reports/results.json` is machine-readable and useful in CI.

## Tips for flaky tests and debugging

1. Run single test: `npx jest path/to/file.spec.ts -i --runInBand`.
2. Use `jest.resetAllMocks()` or `jest.clearAllMocks()` in `afterEach` to ensure isolation.
3. Avoid concurrency issues by using `--runInBand` when debugging.
4. Use typed mocks (`jest.fn<Return, Args>()`) to keep TypeScript strict and satisfy ESLint.
5. Prefer testing behavior via public methods (don't call private helpers directly unless absolutely necessary).

## CI integration (GitHub Actions example)

`.github/workflows/test.yml`:

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test --silent
      - run: npx jest --coverage --ci
      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage
      - name: Upload junit
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: junit
          path: reports/junit
```

This will run tests, produce a coverage folder and optional JUnit artifacts for CI tools.

## Simple test with result

1. Run command `npm run test`
2. Result from the test (Command Prompt screenshot). This result contains:
- `PASS` or `FAIL` status in each test suite.
- Total number of test cases and test suites.
- Total number of passed/failed test cases and test suites.
- Time to run all the test cases

![Test Report](/test/test_report.png)


## Appendix: useful commands

```bash
npm run test
npx jest src/auth/auth.service.spec.ts -i
npx jest --coverage
npx jest --json --outputFile=reports/results.json
npx jest --reporters=default --reporters=jest-junit
```