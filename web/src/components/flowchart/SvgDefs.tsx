/**
 * @module web/components/flowchart/SvgDefs
 * @description SVG marker definitions - ReactFlow 캔버스에서 1회만 렌더링
 * 개별 엣지 컴포넌트에서 중복 정의하는 것을 방지합니다.
 */

function SvgDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
        </marker>
      </defs>
    </svg>
  );
}

export default SvgDefs;
