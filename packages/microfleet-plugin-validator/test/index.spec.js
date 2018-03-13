/* eslint-env node, mocha */
const { expect } = require('chai');

describe('Validator suite', function testSuite() {
  const Mservice = require('@microfleet/core');

  it('no `validator` plugin, it emits an error or throws', function test() {
    const service = new Mservice({ plugins: [] });
    expect(() => service.validator).to.throw();
  });

  it('validator inits relative schema paths', function test() {
    expect(() => {
      this.service = new Mservice({
        plugins: ['validator'],
        validator: ['./fixtures'],
      });
    }).to.not.throw();

    expect(!!this.service.validator.ajv.getSchema('test-schema')).to.be.eq(true);
    expect(!!this.service.validator.ajv.getSchema('config')).to.be.eq(true);
  });

  it('validator exposes validate methods on the service', function test() {
    expect(this.service).to.have.ownProperty('validate');
    expect(this.service).to.have.ownProperty('validateSync');
    expect(this.service.validate).to.be.a('function');
    expect(this.service.validateSync).to.be.a('function');
  });

  it('validator throw on invalid config when `config` schema is present', function test() {
    expect(() => {
      this.service = new Mservice({
        plugins: ['validator'],
        validator: ['./fixtures'],
        invalid: 'mwhaha',
      });
    }).to.throw();
  });

  it('should be able to load config as object', () => {
    expect(() => {
      this.service = new Mservice({
        plugins: ['validator'],
        validator: {
          schemas: ['./fixtures'],
          ajv: {
            coerceTypes: true,
          },
        },
      });
    }).to.not.throw();

    expect(!!this.service.validator.ajv.getSchema('test-schema')).to.be.eq(true);
    expect(this.service.validateSync('test-types-schema', '1').doc).to.be.eq('1');
    expect(!!this.service.validator.ajv.getSchema('config')).to.be.eq(true);
  });
});
