import * as spec from '@jsii/spec';
import { TypeFingerprinter } from '../../lib/jsii/fingerprinting';
import { fakeAssembly } from '../jsii/fake-assembly';

describe('TypeFingerprinter FQN references', () => {
  test('should handle method references like Class#method', () => {
    const assembly = fakeAssembly({
      name: '@aws-cdk/fake',
      types: {
        '@aws-cdk/fake.core.SomeClass': {
          kind: spec.TypeKind.Class,
          name: 'SomeClass',
          assembly: '@aws-cdk/fake',
          fqn: '@aws-cdk/fake.core.SomeClass',
          methods: [
            {
              name: 'apply',
              returns: undefined,
            },
          ],
        } as spec.ClassType,
      },
    });

    const fingerprinter = new TypeFingerprinter([assembly]);

    // This should not throw or return undefined - it should find the base class
    const fingerprint = fingerprinter.fingerprintType('@aws-cdk/fake.core.SomeClass#apply');

    // Should produce same fingerprint as the base class
    const baseFingerprint = fingerprinter.fingerprintType('@aws-cdk/fake.core.SomeClass');

    expect(fingerprint).toBe(baseFingerprint);
  });

  test('should handle enum member references like Enum.VALUE', () => {
    const assembly = fakeAssembly({
      name: 'test-lib',
      types: {
        'test-lib.MyEnum': {
          kind: spec.TypeKind.Enum,
          name: 'MyEnum',
          assembly: 'test-lib',
          fqn: 'test-lib.MyEnum',
          members: [{ name: 'VALUE_A' }, { name: 'VALUE_B' }],
        } as spec.EnumType,
      },
    });

    const fingerprinter = new TypeFingerprinter([assembly]);

    // This should work for enum value references
    const fingerprint = fingerprinter.fingerprintType('test-lib.MyEnum#VALUE_A');
    const baseFingerprint = fingerprinter.fingerprintType('test-lib.MyEnum');

    expect(fingerprint).toBe(baseFingerprint);
  });
});
