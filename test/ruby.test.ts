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
    // Known acronyms are upper-cased
    ['s3', 'S3'],
    ['vpc', 'VPC'],
    ['iam', 'IAM'],
    ['aws', 'AWS'],
  ])('formats %s -> %s', (input, expected) => {
    expect(rubyModuleName(input)).toBe(expected);
  });

  test('handles scoped package names (@scope/name)', () => {
    expect(rubyModuleName('@aws-cdk/core')).toBe('AWSCDK::Core');
  });

  test('respects caller-supplied acronyms in addition to the built-in CDK list', () => {
    // 'FOO' is not a built-in acronym; passing it should upper-case the segment.
    expect(rubyModuleName('myFoo', ['FOO'])).toBe('MyFOO');
    // Built-in CDK acronyms still apply even when custom ones are supplied.
    expect(rubyModuleName('s3', ['FOO'])).toBe('S3');
    // A custom acronym that overlaps a built-in is deduplicated (applied once, not twice).
    expect(rubyModuleName('s3', ['S3'])).toBe('S3');
  });
});

describe('guessRubyModuleName', () => {
  test.each([
    // The core CDK library's explicit .jsiirc.json naming is mirrored: AWSCDK root,
    // redundant service-level `aws` prefix dropped from submodules.
    ['aws-cdk-lib', 'AWSCDK'],
    ['aws-cdk-lib.aws_s3', 'AWSCDK::S3'],
    ['aws-cdk-lib.aws_ec2', 'AWSCDK::EC2'],
    ['aws-cdk-lib.pipelines', 'AWSCDK::Pipelines'],
    // Non-CDK assemblies follow the default naming rules, with submodules nested via `::`.
    ['jsii-calc', 'JsiiCalc'],
    ['jsii-calc.submodule', 'JsiiCalc::Submodule'],
  ])('guesses %s -> %s', (input, expected) => {
    expect(guessRubyModuleName(input)).toBe(expected);
  });
});
