import React from 'react';

import styles from './ResponsiveImage.module.css';

interface ResponsiveImageProps {
  /**
   * The default image source (highest resolution)
   */
  src: string;
  /**
   * Alternative text for accessibility
   */
  alt: string;
  /**
   * CSS class name
   */
  className?: string;
  /**
   * Width attribute for the image
   */
  width?: number;
  /**
   * Height attribute for the image
   */
  height?: number;
  /**
   * Loading strategy ('lazy' or 'eager')
   */
  loading?: 'lazy' | 'eager';
  /**
   * Sizes attribute for responsive images
   * Default: '100vw' (image takes full viewport width)
   */
  sizes?: string;
  /**
   * Custom srcset string
   * If not provided, will be generated from the src
   */
  srcSet?: string;
  /**
   * Object-fit property for the image
   */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  /**
   * Whether the image is decorative (no alt text needed)
   */
  decorative?: boolean;
}

/**
 * ResponsiveImage component for optimized image loading
 *
 * Automatically generates srcset for different viewport sizes
 * and supports lazy loading for better performance.
 */
const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  className,
  width,
  height,
  loading = 'lazy',
  sizes = '100vw',
  srcSet,
  objectFit,
  decorative = false,
}) => {
  // Generate srcset if not provided
  const generatedSrcSet = srcSet || generateSrcSet(src);

  // Get the appropriate CSS class for object-fit
  const getObjectFitClass = () => {
    if (!objectFit) return '';

    switch (objectFit) {
      case 'contain':
        return styles.objectFitContain;
      case 'cover':
        return styles.objectFitCover;
      case 'fill':
        return styles.objectFitFill;
      case 'none':
        return styles.objectFitNone;
      case 'scale-down':
        return styles.objectFitScaleDown;
      default:
        return '';
    }
  };

  return (
    <img
      src={src}
      srcSet={generatedSrcSet}
      sizes={sizes}
      alt={decorative ? '' : alt}
      className={`${styles.responsiveImage} ${className || ''} ${getObjectFitClass()}`}
      width={width}
      height={height}
      loading={loading}
    />
  );
};

/**
 * Generate a srcset string from a source image URL
 *
 * This function assumes that there are different sized versions of the image
 * with suffixes like -small, -medium, etc.
 *
 * @param src The original image source
 * @returns A srcset string for different viewport widths
 */
function generateSrcSet(src: string): string {
  // Check if the source is an SVG (vector image)
  if (src.endsWith('.svg')) {
    return src; // SVGs are already responsive, no need for srcset
  }

  // For other image types, generate srcset
  const lastDotIndex = src.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return src; // No file extension found, return as is
  }

  const basePath = src.substring(0, lastDotIndex);
  const extension = src.substring(lastDotIndex);

  // Generate srcset with different sizes
  return `
    ${basePath}-small${extension} 480w,
    ${basePath}-medium${extension} 768w,
    ${src} 1200w
  `.trim();
}

export default ResponsiveImage;
