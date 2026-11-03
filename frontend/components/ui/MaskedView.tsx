import type { ComponentType, ReactElement } from 'react';
import type { ViewProps } from 'react-native';
import MaskedViewBase from '@react-native-masked-view/masked-view';

export type MaskedViewProps = ViewProps & {
  maskElement: ReactElement;
  androidRenderingMode?: 'software' | 'hardware';
};

/**
 * Typed re-export of @react-native-masked-view/masked-view. Its class typings predate
 * React 19's JSX types ("JSX element class does not support attributes"), so the same
 * native component is exposed here as a plain component type.
 */
const MaskedView = MaskedViewBase as unknown as ComponentType<MaskedViewProps>;

export default MaskedView;
