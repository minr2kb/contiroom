'use client';

import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Spinner } from '@astryxdesign/core/Spinner';
import { VStack } from '@astryxdesign/core/VStack';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { RotateCw } from 'lucide-react';
import { Component, type ReactNode, Suspense } from 'react';

type QueryErrorBoundaryProps = {
  children: ReactNode;
  onReset: () => void;
  errorTitle: string;
};

type QueryErrorBoundaryState = {
  error: Error | null;
};

class QueryErrorBoundary extends Component<QueryErrorBoundaryProps, QueryErrorBoundaryState> {
  state: QueryErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): QueryErrorBoundaryState {
    return { error };
  }

  private retry = () => {
    this.props.onReset();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <Banner
          status="error"
          title={this.props.errorTitle}
          endContent={<Button label="다시 시도" icon={<RotateCw aria-hidden="true" />} onClick={this.retry} />}
        />
      );
    }

    return this.props.children;
  }
}

type QueryBoundaryProps = {
  children: ReactNode;
  loadingLabel: string;
  errorTitle: string;
};

export const QueryBoundary = ({ children, loadingLabel, errorTitle }: QueryBoundaryProps) => (
  <QueryErrorResetBoundary>
    {({ reset }) => (
      <QueryErrorBoundary onReset={reset} errorTitle={errorTitle}>
        <Suspense
          fallback={
            <VStack paddingBlock={10} align="center">
              <Spinner label={loadingLabel} />
            </VStack>
          }
        >
          {children}
        </Suspense>
      </QueryErrorBoundary>
    )}
  </QueryErrorResetBoundary>
);
