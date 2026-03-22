export function calculateFiveGrid({ surnameStroke, givenStrokes }) {
  const [first = 0, second = 0] = givenStrokes;

  const heaven = surnameStroke;
  const human = surnameStroke + first;
  const earth = first + second;
  const total = surnameStroke + first + second;
  const outer = total - human;

  return {
    heaven,
    human,
    earth,
    outer,
    total
  };
}
