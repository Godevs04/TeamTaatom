const { authValidations } = require('../middleware/validation');

function runValidators(chain, body) {
  const req = { body: { ...body }, params: {}, query: {} };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  return new Promise((resolve, reject) => {
    let index = 0;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ req, res });
    };
    res.json = (payload) => {
      res.payload = payload;
      finish();
      return res;
    };
    const next = (err) => {
      if (settled) return;
      if (err) {
        settled = true;
        reject(err);
        return;
      }
      if (index >= chain.length) {
        finish();
        return;
      }
      const middleware = chain[index];
      index += 1;
      Promise.resolve(middleware(req, res, next)).catch((error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
    };
    next();
  });
}

describe('auth resend OTP validation', () => {
  it('accepts an email-only body', async () => {
    const { res } = await runValidators(authValidations.resendOtp, {
      email: 'traveler@example.com',
    });

    expect(res.statusCode).toBe(200);
    expect(res.payload).toBeNull();
  });

  it('rejects a missing email', async () => {
    const { res } = await runValidators(authValidations.resendOtp, {});

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ error: 'Validation failed' });
  });

  it('still requires a 6-digit otp on verify', async () => {
    const { res } = await runValidators(authValidations.verifyOtp, {
      email: 'traveler@example.com',
    });

    expect(res.statusCode).toBe(400);
    expect(res.payload.errors.some((error) => error.path === 'otp')).toBe(true);
  });
});
