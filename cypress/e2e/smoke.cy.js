describe('ManyTool smoke', () => {
  it('filters the homepage and opens the AI personal color page', () => {
    cy.visit('/');
    cy.get('#tool-search').should('be.visible').type('퍼스널컬러');
    cy.get('[data-card][data-fav-key="/ai-personal-color"]:visible')
      .first()
      .should('exist')
      .click();
    cy.location('pathname').should('eq', '/ai-personal-color');
  });

  it('renders the AI personal color page shell', () => {
    cy.visit('/ai-personal-color');
    cy.get('#file-input').should('exist');
    cy.get('#camera-start').should('be.visible');
    cy.get('#analyze-button').should('be.disabled');
    cy.get('#status').should('be.visible');
  });
});
