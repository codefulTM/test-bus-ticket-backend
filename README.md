## Introduction

Our team introduce The Bus Ticket Booking System web application which streamlines the process of purchasing bus tickets online. This app enables passengers to search for routes, compare prices, select seats, and make payments digitally by eliminating the need for physical ticket counters or manual reservations.

This repository is the backend code for this system.

This project is still in development.

## Some common commands used for project

### Project setup

```bash
$ npm install
```

### Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

### Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

### Code formatting (using prettier)

```bash
## format code
$ npm run format
```

## Documents about the project

(More documents will be updated here in further development)

## Public host

Our project is hosted using [Render](https://render.com/), you can check out the link to this project here:

https://bus-ticket-backend-vut1.onrender.com

## Authentication Architecture

For a detailed explanation of our authentication system, including the Access Token + Refresh Token model and session flow, please refer to [AUTHENTICATION.md](./docs/authentication.md).

More detail about the reason why we using HTTP-only Cookies to enhanced security, please refer to [MIGRATION-TO-COOKIES.md](./docs/migration-to-cookies.md).

We also implemented some unit tests for authentication and authorization (inside `auth` and `admin` module), more information please refer to [UNIT-TESTS.md](./docs/unit-tests.md).

More documents about our project you can find and read in our folder **docs**