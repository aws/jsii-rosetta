import { toSnakeCase, rubyModuleName, guessRubyModuleName } from '../lib/languages/ruby';

describe('toSnakeCase', () => {
  test.each([
    // Plain camelCase
    ['foo', 'foo'],
    ['someMethod', 'some_method'],
    ['arnValue', 'arn_value'],
    // Single characters / digits
    ['x', 'x'],
    ['getX', 'get_x'],
    // Consecutive uppercase (acronyms) collapse correctly
    ['enforceSSL', 'enforce_ssl'],
    ['myVPCId', 'my_vpc_id'],
    ['parseJSON', 'parse_json'],
    ['toJSON', 'to_json'],
    ['ec2InstanceId', 'ec2_instance_id'],
    ['x509Certificate', 'x509_certificate'],
    ['fromHTTPSToJSON', 'from_https_to_json'],
    // Already snake_case is left alone
    ['already_snake', 'already_snake'],
    // Leading underscore is preserved
    ['_privateField', '_private_field'],
  ])('converts %s -> %s', (input, expected) => {
    expect(toSnakeCase(input)).toBe(expected);
  });

  test('leaves PascalCase (class-like) names untouched', () => {
    expect(toSnakeCase('MyClass')).toBe('MyClass');
    expect(toSnakeCase('Bucket')).toBe('Bucket');
  });

  test.each(['end', 'class', 'def', 'begin', 'send', 'next', 'retry'])(
    'escapes reserved word %s with a leading underscore',
    (word) => {
      expect(toSnakeCase(word)).toBe(`_${word}`);
    },
  );
});

describe('rubyModuleName', () => {
  test.each([
    // Simple names get PascalCased
    ['core', 'Core'],
    ['submodule', 'Submodule'],
    ['foo', 'Foo'],
    ['child', 'Child'],
    ['homonymousForwardReferences', 'HomonymousForwardReferences'],
    // Hyphenated package names become a single concatenated module
    ['jsii-calc', 'JsiiCalc'],
    // Without declared acronyms there is no acronym knowledge: plain PascalCase.
    // Acronym casing is library data (`targets.ruby.acronyms` in the assembly),
    // not something this visitor knows on its own.
    ['s3', 'S3'], // single letter + digit pascals to S3 with no list involved
    ['vpc', 'Vpc'],
    ['iam', 'Iam'],
    ['aws', 'Aws'],
  ])('formats %s -> %s', (input, expected) => {
    expect(rubyModuleName(input)).toBe(expected);
  });

  test('handles scoped package names (@scope/name)', () => {
    expect(rubyModuleName('@aws-cdk/core', ['AWS', 'CDK'])).toBe('AWSCDK::Core');
    expect(rubyModuleName('@aws-cdk/core')).toBe('AwsCdk::Core');
  });

  test('declared acronyms are authoritative — the mechanism, with test-owned data', () => {
    // Any caller-declared acronym is honoured...
    expect(rubyModuleName('myFoo', ['FOO'])).toBe('MyFOO');
    expect(rubyModuleName('vpc', ['VPC'])).toBe('VPC');
    // ...and an undeclared one has no effect, because there is no built-in list.
    expect(rubyModuleName('vpc', ['FOO'])).toBe('Vpc');
    // Duplicated declarations are applied once, not twice.
    expect(rubyModuleName('vpc', ['VPC', 'VPC'])).toBe('VPC');
  });

  test('short acronyms do not over-match inside unrelated words', () => {
    expect(rubyModuleName('certificate', ['CE'])).toBe('Certificate');
    expect(rubyModuleName('database', ['DB'])).toBe('Database');
    expect(rubyModuleName('ramp', ['RAM'])).toBe('Ramp');
  });
});

describe('guessRubyModuleName', () => {
  test.each([
    // The core CDK library's explicit .jsiirc.json naming is mirrored: AWSCDK root,
    // redundant service-level `aws` prefix dropped from submodules.
    ['aws-cdk-lib', 'AWSCDK'],
    ['aws-cdk-lib.aws_s3', 'AWSCDK::S3'],
    // Without an assembly there is no acronym config, so multi-letter service
    // names get plain PascalCase — an honest guess, not fake authority.
    ['aws-cdk-lib.aws_ec2', 'AWSCDK::Ec2'],
    ['aws-cdk-lib.pipelines', 'AWSCDK::Pipelines'],
    // Non-CDK assemblies follow the default naming rules, with submodules nested via `::`.
    ['jsii-calc', 'JsiiCalc'],
    ['jsii-calc.submodule', 'JsiiCalc::Submodule'],
  ])('guesses %s -> %s', (input, expected) => {
    expect(guessRubyModuleName(input)).toBe(expected);
  });
});
